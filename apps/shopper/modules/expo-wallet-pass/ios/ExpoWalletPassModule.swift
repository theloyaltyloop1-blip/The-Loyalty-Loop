import ExpoModulesCore
import PassKit
import UIKit

public class ExpoWalletPassModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoWalletPass")

    AsyncFunction("addPass") { (base64: String, promise: Promise) in
      DispatchQueue.main.async {
        guard let data = Data(base64Encoded: base64) else {
          promise.reject("E_DECODE", "Could not decode pass data")
          return
        }

        let pass: PKPass
        do {
          pass = try PKPass(data: data)
        } catch {
          promise.reject("E_PASS", error.localizedDescription)
          return
        }

        guard let addController = PKAddPassesViewController(pass: pass) else {
          promise.reject("E_PRESENT", "Could not create the Add to Wallet screen")
          return
        }

        guard let root = UIApplication.shared.connectedScenes
          .compactMap({ ($0 as? UIWindowScene)?.keyWindow })
          .first?.rootViewController else {
          promise.reject("E_NO_ROOT", "No screen to present the Add to Wallet UI from")
          return
        }

        var top = root
        while let presented = top.presentedViewController {
          top = presented
        }

        top.present(addController, animated: true) {
          promise.resolve(nil)
        }
      }
    }
  }
}
