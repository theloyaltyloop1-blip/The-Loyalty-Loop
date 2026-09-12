import { readRetailerWidgetState } from './state'
import { renderRetailerWidget } from './android'

export async function retailerWidgetTask({ renderWidget }: { renderWidget: (widget: ReturnType<typeof renderRetailerWidget>) => void }) {
  const state = await readRetailerWidgetState()
  renderWidget(renderRetailerWidget(state || {
    businessName: 'The Loyalty Loop', todayActions: 0, members: 0, updatedAt: new Date().toISOString(), brandColor: '', logoUrl: '',
  }))
}
