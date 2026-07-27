import AVFoundation
import CoreGraphics
import CoreVideo
import Foundation
import ImageIO

let args = CommandLine.arguments
guard args.count == 3 else {
    fputs("usage: encode_realtime_question_coach_guide <slides-dir> <output.mp4>\n", stderr)
    exit(2)
}

let slidesDirectory = URL(fileURLWithPath: args[1], isDirectory: true)
let outputURL = URL(fileURLWithPath: args[2])
let width = 1920
let height = 1080
let fps = 30
let sceneFrames = 90 // 3 seconds per still
let transitionFrames = 12 // 0.4 seconds cross-fade

let slideURLs: [URL] = (try! FileManager.default.contentsOfDirectory(
    at: slidesDirectory,
    includingPropertiesForKeys: nil,
    options: [.skipsHiddenFiles]
)).filter {
    $0.lastPathComponent.hasPrefix("scene-") && $0.pathExtension.lowercased() == "png"
}.sorted { $0.lastPathComponent < $1.lastPathComponent }
guard slideURLs.count >= 2 else { fatalError("At least two scene PNGs are required") }

func loadImage(_ url: URL) -> CGImage {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        fatalError("Could not load slide: \(url.path)")
    }
    return image
}

let images = slideURLs.map(loadImage)
try? FileManager.default.removeItem(at: outputURL)

let fileType: AVFileType = outputURL.pathExtension.lowercased() == "mov" ? .mov : .mp4
let writer = try AVAssetWriter(outputURL: outputURL, fileType: fileType)
let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 10_000_000,
        AVVideoExpectedSourceFrameRateKey: fps,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    ],
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: input,
    sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
        kCVPixelBufferCGImageCompatibilityKey as String: true,
        kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
    ]
)
writer.add(input)
guard writer.startWriting() else {
    fatalError("Could not start writer: \(String(describing: writer.error))")
}
writer.startSession(atSourceTime: .zero)

func makePixelBuffer(_ image: CGImage, alpha: CGFloat = 1.0) -> CVPixelBuffer {
    var pixelBuffer: CVPixelBuffer?
    let status = CVPixelBufferCreate(
        kCFAllocatorDefault,
        width,
        height,
        kCVPixelFormatType_32BGRA,
        [
            kCVPixelBufferCGImageCompatibilityKey: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey: true,
        ] as CFDictionary,
        &pixelBuffer
    )
    guard status == kCVReturnSuccess, let buffer = pixelBuffer else {
        fatalError("Could not allocate pixel buffer: \(status)")
    }
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard let baseAddress = CVPixelBufferGetBaseAddress(buffer) else { fatalError("Missing pixel buffer base address") }
    let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
    let bitmapInfo = CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
    guard let context = CGContext(
        data: baseAddress,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: bitmapInfo
    ) else { fatalError("Could not create drawing context") }
    context.setFillColor(CGColor(red: 0.965, green: 0.973, blue: 0.961, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.setAlpha(alpha)
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return buffer
}

func append(_ pixelBuffer: CVPixelBuffer, frame: Int) {
    while !input.isReadyForMoreMediaData {
        Thread.sleep(forTimeInterval: 0.001)
    }
    let time = CMTime(value: CMTimeValue(frame), timescale: CMTimeScale(fps))
    guard adaptor.append(pixelBuffer, withPresentationTime: time) else {
        fatalError(writer.error?.localizedDescription ?? "Could not append frame \(frame)")
    }
}

var frame = 0
for index in images.indices {
    let current = makePixelBuffer(images[index])
    for _ in 0..<sceneFrames {
        append(current, frame: frame)
        frame += 1
    }
    guard index < images.count - 1 else { continue }
    for transition in 1...transitionFrames {
        // Rendering the blend in a fresh buffer keeps each still lossless before H.264 encoding.
        var blend: CVPixelBuffer?
        let status = CVPixelBufferCreate(
            kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA,
            [kCVPixelBufferCGImageCompatibilityKey: true, kCVPixelBufferCGBitmapContextCompatibilityKey: true] as CFDictionary,
            &blend
        )
        guard status == kCVReturnSuccess, let buffer = blend else { fatalError("Could not allocate transition buffer") }
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        guard let baseAddress = CVPixelBufferGetBaseAddress(buffer),
              let context = CGContext(
                data: baseAddress,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
              ) else { fatalError("Could not create transition context") }
        let progress = CGFloat(transition) / CGFloat(transitionFrames + 1)
        context.setFillColor(CGColor(red: 0.965, green: 0.973, blue: 0.961, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.setAlpha(1 - progress)
        context.draw(images[index], in: CGRect(x: 0, y: 0, width: width, height: height))
        context.setAlpha(progress)
        context.draw(images[index + 1], in: CGRect(x: 0, y: 0, width: width, height: height))
        append(buffer, frame: frame)
        frame += 1
    }
}

input.markAsFinished()
let group = DispatchGroup()
group.enter()
writer.finishWriting { group.leave() }
group.wait()
guard writer.status == .completed else { fatalError(writer.error?.localizedDescription ?? "Could not finish writer") }
print("wrote \(outputURL.path) (\(frame) frames, \(Double(frame) / Double(fps))s)")
