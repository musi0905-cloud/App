//
//  ShimSmokeTests.swift
//  ShimTests
//
//  Sprint 0 — 테스트 타깃이 실제로 구성되고 실행되는지 확인하는 스모크 테스트.
//
//  이 테스트는 제품 로직을 검증하지 않는다. 테스트 번들이 앱을 host로
//  로드할 수 있는지만 확인한다. 실제 Domain 테스트(RestPlan decoding 등)는
//  Sprint 1부터 추가한다.
//

import XCTest
@testable import Shim

final class ShimSmokeTests: XCTestCase {

    /// 테스트 타깃이 앱 모듈을 import하고 실행될 수 있음을 확인한다.
    func testTestTargetRuns() {
        XCTAssertTrue(true, "테스트 번들이 로드되고 실행되었다.")
    }

    /// 앱 진입점 타입이 테스트 대상 모듈에 존재하는지 확인한다.
    func testAppEntryPointExists() {
        XCTAssertEqual(String(describing: ShimApp.self), "ShimApp")
    }
}
