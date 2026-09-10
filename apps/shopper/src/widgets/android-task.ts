import { readShopperWidgetState, SHOPPER_WIDGET_NAME } from './state'
import { renderShopperWidget } from './android'

export async function shopperWidgetTask({ renderWidget }: { renderWidget: (widget: ReturnType<typeof renderShopperWidget>) => void }) {
  const state = await readShopperWidgetState()
  renderWidget(renderShopperWidget(state || {
    shopName: 'The Loyalty Loop', current: 0, target: 10, unit: 'stamps', remaining: 10, brandColor: '#EF7136', updatedAt: new Date().toISOString(),
  }))
}
