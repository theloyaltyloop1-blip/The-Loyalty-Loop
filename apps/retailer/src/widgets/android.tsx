import React from 'react'
import { FlexWidget, TextWidget } from 'react-native-android-widget'
import type { RetailerWidgetState } from './state'

export function renderRetailerWidget(state: RetailerWidgetState) {
  const activity = state.todayActions === 1 ? '1 loyalty action today' : `${state.todayActions} loyalty actions today`
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'loyaltyloop-business://widget/scan' }}
      accessibilityLabel={`Open the scanner for ${state.businessName}. ${activity}.`}
      style={{
        width: 'match_parent', height: 'match_parent', flexDirection: 'column', justifyContent: 'space-between',
        backgroundColor: '#1D211C', borderRadius: 22, padding: 18,
      }}
    >
      <TextWidget text={state.businessName} maxLines={1} style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }} />
      <TextWidget text="SCAN CUSTOMER" style={{ color: '#EF7136', fontSize: 13, fontWeight: 'bold', marginTop: 10 }} />
      <TextWidget text={activity} style={{ color: '#E9E5DD', fontSize: 16, marginTop: 3 }} />
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
        <TextWidget text={`${state.members} members`} style={{ color: '#B7B4AC', fontSize: 13 }} />
        <TextWidget text="Open scanner  →" style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }} />
      </FlexWidget>
    </FlexWidget>
  )
}
