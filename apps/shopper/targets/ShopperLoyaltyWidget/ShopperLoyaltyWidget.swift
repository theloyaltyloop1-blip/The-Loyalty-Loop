import SwiftUI
import WidgetKit

private let appGroup = "group.com.theloyaltyloop.shopper"
private let stateKey = "loyalty-loop:shopper-widget"

struct ShopperWidgetEntry: TimelineEntry {
  let date: Date
  let shopName: String
  let current: Int
  let target: Int
  let unit: String
  let remaining: Int
  let brandColor: String
}

struct ShopperWidgetProvider: TimelineProvider {
  func placeholder(in context: Context) -> ShopperWidgetEntry { example }
  func getSnapshot(in context: Context, completion: @escaping (ShopperWidgetEntry) -> Void) { completion(readEntry()) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<ShopperWidgetEntry>) -> Void) {
    completion(Timeline(entries: [readEntry()], policy: .after(Date().addingTimeInterval(30 * 60))))
  }

  private var example: ShopperWidgetEntry {
    ShopperWidgetEntry(date: Date(), shopName: "Your favourite shop", current: 7, target: 10, unit: "stamps", remaining: 3, brandColor: "#EF7136")
  }

  private func readEntry() -> ShopperWidgetEntry {
    let values = UserDefaults(suiteName: appGroup)?.dictionary(forKey: stateKey)
    return ShopperWidgetEntry(
      date: Date(),
      shopName: values?["shopName"] as? String ?? "The Loyalty Loop",
      current: values?["current"] as? Int ?? 0,
      target: values?["target"] as? Int ?? 10,
      unit: values?["unit"] as? String ?? "stamps",
      remaining: values?["remaining"] as? Int ?? 10,
      brandColor: values?["brandColor"] as? String ?? "#EF7136"
    )
  }
}

struct ShopperLoyaltyWidgetView: View {
  let entry: ShopperWidgetEntry

  var body: some View {
    Link(destination: URL(string: "loyaltyloop://widget/qr")!) {
      VStack(alignment: .leading, spacing: 8) {
        Text(entry.shopName).font(.headline).lineLimit(1).foregroundStyle(.black)
        Spacer(minLength: 0)
        HStack(alignment: .lastTextBaseline, spacing: 5) {
          Text("\(entry.current)").font(.system(size: 36, weight: .bold)).foregroundStyle(widgetColour)
          Text("/ \(entry.target) \(entry.unit)").font(.subheadline).foregroundStyle(.secondary)
        }
        Text(entry.remaining == 0 ? "Reward ready" : "\(entry.remaining) \(entry.unit) until your reward")
          .font(.subheadline).foregroundStyle(.primary).lineLimit(2)
        Text("Show customer card  →").font(.caption.weight(.bold)).foregroundStyle(widgetColour)
      }
      .containerBackground(for: .widget) { Color(red: 1.0, green: 0.976, blue: 0.94) }
    }
  }

  private var widgetColour: Color { Color(hex: entry.brandColor) }
}

struct ShopperLoyaltyWidget: Widget {
  let kind = "ShopperLoyaltyWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ShopperWidgetProvider()) { entry in ShopperLoyaltyWidgetView(entry: entry) }
      .configurationDisplayName("Loyalty progress")
      .description("See the next reward and open your customer card.")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct ShopperLoyaltyWidgetBundle: WidgetBundle {
  var body: some Widget { ShopperLoyaltyWidget() }
}

private extension Color {
  init(hex: String) {
    let value = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    let number = UInt64(value, radix: 16) ?? 0xEF7136
    self.init(.sRGB, red: Double((number >> 16) & 0xFF) / 255, green: Double((number >> 8) & 0xFF) / 255, blue: Double(number & 0xFF) / 255, opacity: 1)
  }
}
