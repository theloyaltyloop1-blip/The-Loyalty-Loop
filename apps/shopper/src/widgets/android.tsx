import React from 'react'
import { FlexWidget, TextWidget } from 'react-native-android-widget'
import type { ShopperWidgetState } from './state'

export function renderShopperWidget(state: ShopperWidgetState) {
  const progress = state.remaining === 0
    ? 'Reward ready'
    : `${state.remaining} ${state.unit} until your reward`

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'loyaltyloop://widget/qr' }}
      accessibilityLabel={`Open your Loyalty Loop card. ${progress}.`}
      style={{
        width: 'match_parent', height: 'match_parent', flexDirection: 'column', justifyContent: 'space-between',
        backgroundColor: '#FFF9F0', borderRadius: 22, padding: 18,
      }}
    >
      <TextWidget text={state.shopName} maxLines={1} style={{ color: '#1E1B19', fontSize: 16, fontWeight: 'bold' }} />
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 6 }}>
        <TextWidget text={String(state.current)} style={{ color: state.brandColor as `#${string}`, fontSize: 34, fontWeight: 'bold' }} />
        <TextWidget text={`/ ${state.target} ${state.unit}`} style={{ color: '#6D6A65', fontSize: 14, marginBottom: 6 }} />
      </FlexWidget>
      <TextWidget text={progress} maxLines={2} style={{ color: '#45413D', fontSize: 14 }} />
      <TextWidget text="Show customer card  →" style={{ color: state.brandColor as `#${string}`, fontSize: 14, fontWeight: 'bold', marginTop: 8 }} />
    </FlexWidget>
  )
}
