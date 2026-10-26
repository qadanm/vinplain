import ExpoModulesCore
import Vision
import UIKit

/**
 On-device VIN text recognition with Apple's Vision framework.

 The photo is processed entirely on device: no network request, no per-scan
 cost, and it works without a signal.

 The module deliberately returns *raw recognized text* rather than trying to
 pick a VIN. Selection, normalization, OCR-confusion repair, and check-digit
 validation live in the TypeScript layer (`vinplain`). Vision's only
 job is to read characters off the glass.
 */
public class VinOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VinOcr")

    AsyncFunction("recognizeText") { (uri: String, promise: Promise) in
      guard let image = Self.loadImage(from: uri), let cgImage = image.cgImage else {
        promise.reject("E_IMAGE", "Could not read the photo at \(uri)")
        return
      }

      let request = VNRecognizeTextRequest { request, error in
        if let error = error {
          promise.reject("E_VISION", error.localizedDescription)
          return
        }
        let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
        // Keep the top candidate per observation. The TS engine scans the joined
        // text for 17-char windows, so extra lines cost nothing and a VIN split
        // across lines still gets caught by the separator-stripped pass.
        let lines = observations.compactMap { $0.topCandidates(1).first?.string }
        promise.resolve(lines)
      }

      request.recognitionLevel = .accurate
      // A VIN is a serial number, not prose. Language correction is built for
      // words and can rewrite serial-like strings, so Apple's guidance is to
      // turn it off for non-linguistic text. Measured on a clean render it made
      // no difference either way; this is insurance for marginal reads, not a
      // fix for a known failure.
      request.usesLanguageCorrection = false
      request.recognitionLanguages = ["en-US"]
      if #available(iOS 16.0, *) {
        request.revision = VNRecognizeTextRequestRevision3
      }

      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
        } catch {
          promise.reject("E_VISION", error.localizedDescription)
        }
      }
    }
  }

  /// Accepts `file://` URLs (what expo-camera hands back) and bare paths.
  private static func loadImage(from uri: String) -> UIImage? {
    if let url = URL(string: uri), url.isFileURL, let data = try? Data(contentsOf: url) {
      return UIImage(data: data)
    }
    if let data = FileManager.default.contents(atPath: uri) {
      return UIImage(data: data)
    }
    return nil
  }
}
