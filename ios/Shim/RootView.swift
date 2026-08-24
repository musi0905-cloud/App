//
//  RootView.swift
//  Shim
//
//  Sprint 0 플레이스홀더 화면.
//
//  주의: Home / RestSession / RestResult 화면과 네비게이션 흐름은
//  Sprint 1의 범위다. 이 파일은 프로젝트가 빌드되고 실행되는지
//  확인하기 위한 최소 화면일 뿐이며, 제품 UI가 아니다.
//

import SwiftUI

struct RootView: View {
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 12) {
                Text("쉼")
                    .font(.system(size: 44, weight: .light))
                    .foregroundStyle(.white)

                Text("Sprint 0 — 개발 환경 및 저장소 기초")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.5))
            }
        }
    }
}

#Preview {
    RootView()
}
