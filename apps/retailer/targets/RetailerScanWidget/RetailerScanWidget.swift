import SwiftUI
import WidgetKit

private let appGroup = "group.com.theloyaltyloop.retailer"
private let stateKey = "loyalty-loop:retailer-widget"
private let defaultBrand = "#EF7136"
private let ink = Color(red: 0.114, green: 0.129, blue: 0.11)

struct RetailerWidgetEntry: TimelineEntry {
  let date: Date
  let businessName: String
  let todayActions: Int
  let members: Int
  let brand: Color
  let brandDark: Color
  var logo: UIImage? = nil
}

/// "#rrggbb" → Color, with each channel multiplied by `factor` (< 1 darkens).
private func color(fromHex hex: String?, factor: Double = 1) -> Color {
  let candidate = (hex?.hasPrefix("#") == true && hex?.count == 7) ? hex! : defaultBrand
  let value = UInt32(candidate.dropFirst(), radix: 16) ?? 0xEF7136
  func channel(_ shift: UInt32) -> Double { min(1, Double((value >> shift) & 0xFF) / 255 * factor) }
  return Color(red: channel(16), green: channel(8), blue: channel(0))
}

struct RetailerWidgetProvider: TimelineProvider {
  func placeholder(in context: Context) -> RetailerWidgetEntry { example }
  func getSnapshot(in context: Context, completion: @escaping (RetailerWidgetEntry) -> Void) {
    completion(readEntry().entry)
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<RetailerWidgetEntry>) -> Void) {
    let (entry, logoUrl) = readEntry()
    let policy: TimelineReloadPolicy = .after(Date().addingTimeInterval(30 * 60))
    guard let logoUrl else {
      completion(Timeline(entries: [entry], policy: policy))
      return
    }
    URLSession.shared.dataTask(with: logoUrl) { data, _, _ in
      var withLogo = entry
      withLogo.logo = data.flatMap { UIImage(data: $0) }
      completion(Timeline(entries: [withLogo], policy: policy))
    }.resume()
  }

  private var example: RetailerWidgetEntry {
    RetailerWidgetEntry(date: Date(), businessName: "Your shop", todayActions: 12, members: 86,
                        brand: color(fromHex: defaultBrand), brandDark: color(fromHex: defaultBrand, factor: 0.66))
  }

  private func readEntry() -> (entry: RetailerWidgetEntry, logoUrl: URL?) {
    let values = UserDefaults(suiteName: appGroup)?.dictionary(forKey: stateKey)
    let hex = values?["brandColor"] as? String
    let entry = RetailerWidgetEntry(
      date: Date(),
      businessName: values?["businessName"] as? String ?? "The Loyalty Loop",
      todayActions: values?["todayActions"] as? Int ?? 0,
      members: values?["members"] as? Int ?? 0,
      brand: color(fromHex: hex),
      brandDark: color(fromHex: hex, factor: 0.66)
    )
    let logoUrl = (values?["logoUrl"] as? String).flatMap { URL(string: $0) }
    return (entry, logoUrl)
  }
}

struct RetailerScanWidgetView: View {
  let entry: RetailerWidgetEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    Link(destination: URL(string: "loyaltyloop-business://widget/scan")!) {
      HStack(alignment: .center, spacing: 12) {
        VStack(alignment: .leading, spacing: 4) {
          HStack(spacing: 8) {
            badge
            Text(entry.businessName).font(.subheadline.weight(.bold)).lineLimit(1).foregroundStyle(.white)
          }
          Spacer(minLength: 0)
          Text("\(entry.todayActions)").font(.system(size: 36, weight: .heavy)).foregroundStyle(.white)
          Text(entry.todayActions == 1 ? "visit today" : "visits today")
            .font(.caption).foregroundStyle(.white.opacity(0.88))
          Text("\(entry.members) \(entry.members == 1 ? "member" : "members") on your card")
            .font(.caption2).foregroundStyle(.white.opacity(0.8)).lineLimit(1)
        }
        if family != .systemSmall {
          Spacer(minLength: 0)
          VStack(spacing: 6) {
            ZStack {
              Circle().fill(.white).frame(width: 76, height: 76)
              Image(systemName: "qrcode.viewfinder")
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(ink)
            }
            Text("SCAN").font(.caption2.weight(.bold)).foregroundStyle(.white)
          }
        }
      }
      .containerBackground(for: .widget) {
        LinearGradient(colors: [entry.brand, entry.brandDark], startPoint: .topLeading, endPoint: .bottomTrailing)
      }
    }
  }

  private var badge: some View {
    Group {
      if let logo = entry.logo {
        Image(uiImage: logo).resizable().scaledToFill().frame(width: 30, height: 30).clipShape(Circle())
      } else {
        ZStack {
          Circle().fill(.white.opacity(0.28))
          Text(String(entry.businessName.prefix(1)).uppercased())
            .font(.subheadline.weight(.bold)).foregroundStyle(.white)
        }
        .frame(width: 30, height: 30)
      }
    }
  }
}

struct RetailerScanWidget: Widget {
  let kind = "RetailerScanWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: RetailerWidgetProvider()) { entry in RetailerScanWidgetView(entry: entry) }
      .configurationDisplayName("Open scanner")
      .description("Open the customer scanner and see today's visits.")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct RetailerScanWidgetBundle: WidgetBundle {
  var body: some Widget { RetailerScanWidget() }
}
