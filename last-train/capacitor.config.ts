import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ⚠️ 앱스토어에 올리기 전에 본인 소유 도메인 기반의 번들 ID로 바꾸세요 (예: kr.내도메인.lasttrain).
  //    바꾼 뒤에는 Xcode 의 Signing & Capabilities > Bundle Identifier 도 같은 값인지 확인.
  appId: 'com.example.lasttrain',
  appName: '막차 이상현상',
  webDir: 'dist',
  backgroundColor: '#000000',
  ios: {
    contentInset: 'never', // 노치/홈 인디케이터 영역은 CSS env(safe-area-inset-*) 로 직접 처리
    scrollEnabled: false, // WKWebView 바운스 스크롤 끔
    backgroundColor: '#000000',
    preferredContentMode: 'mobile',
  },
};

export default config;
