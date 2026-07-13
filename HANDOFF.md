# 회사 지원금 구독 플래너 — 개발 인수인계 문서

> 대상 파일: `subscription_planner.html` (단일 HTML, 외부 라이브러리 없이 순수 HTML/CSS/JavaScript)
> 배포: Netlify (`skt-planner.netlify.app`), GitHub 저장소와 연결되어 push할 때마다 자동 배포됨
> 작성 목적: 지금까지의 기획 의도·구현 방식·코드 구조를 다음 개발자가 그대로 이어받을 수 있도록 정리

---

## 1. 이 프로젝트가 하는 일

SKT 회사 지원금(월 한도, 기본 297,000원)을 최대한 활용해서 **휴대전화 요금 + 단말기 할부금 + 구독 서비스**를 2026~2030년 월 단위로 시뮬레이션하는 계산기다. 왼쪽 설정 패널에서 조건을 입력하면 오른쪽의 월별 표에 "이번 달 총 청구액이 얼마고, 지원 한도 대비 얼마가 남는지"가 계산된다.

핵심 목적은 세 가지다.

1. **단말기 할부 스케줄링** — 몇 개월 할부로, 언제 사고, 다음 기기는 언제부터 다시 살 수 있는지 계산
2. **휴대전화 요금 계산** — 실제 SKT 요금제를 고르고, 선택약정/결합/복지 할인을 적용한 실 청구액 계산
3. **구독 서비스 스케줄링** — Google One, OTT, 음악, 전자책, 게임 구독을 연간/월간으로 섞어서 최적 배치

---

## 2. 빠른 시작

- 빌드 과정 없음. `subscription_planner.html`을 브라우저로 열면 끝.
- 저장소 루트의 `_redirects` 파일 한 줄(`/  /subscription_planner.html  200`)이 Netlify에서 루트 URL(`/`)로 접속했을 때 이 파일을 서빙하도록 리다이렉트한다. **파일명을 바꾸면 이 파일도 같이 고쳐야 한다.**
- 상태 저장은 브라우저 메모리에만 있음 (새로고침하면 날아감). 화면 하단 "💾 JSON 저장" / "📂 JSON 불러오기" 버튼으로 수동 백업/복원한다.

---

## 3. 화면 구조

```
┌─────────────────────┬────────────────────────────────────┐
│ 왼쪽 설정 패널(290px) │  오른쪽 결과                         │
│ position: sticky     │                                      │
│                      │  탭: [📅 월별 계획표] [📋 서비스 카탈로그] │
│ ① 기본 조건          │                                      │
│   (지원한도/할부조건/  │  📅 월별 계획표                       │
│    구입일정)          │   - 10열 표 (2026~2030년, 60개월)     │
│                      │   - 4개의 독립 구독 슬롯 드롭다운       │
│ [▶ 오른쪽 표에 반영]  │                                      │
│  (적용 버튼)          │  📋 서비스 카탈로그 (정적 안내용 탭)    │
│                      │                                      │
│ ② 휴대전화 요금       │                                      │
│   (요금제/할인/       │                                      │
│    T우주 결합상품/    │                                      │
│    부가서비스)        │                                      │
└─────────────────────┴────────────────────────────────────┘
```

레이아웃은 CSS Grid(`290px 1fr`)이고 800px 이하에서는 1열로 쌓인다(`@media(max-width:800px)`). 왼쪽 패널은 `position: sticky`로 스크롤해도 고정된다.

---

## 4. 설계 의도 — 왜 이렇게 만들었나 (읽는 순서대로 이해하면 됨)

### 4-1. "적용" 버튼으로 무거운 재계산을 지연시킨 이유

`buildTimeline()` + `renderTable()`은 60개월 × 4슬롯을 순회하며 큰 HTML 문자열을 새로 만드는 무거운 작업이다. 처음에는 왼쪽 입력값이 바뀔 때마다(`oninput`) 이 두 함수를 곧바로 호출했는데, 할부원금처럼 숫자를 한 글자씩 입력하는 필드에서 매 키 입력마다 표 전체가 다시 그려져 입력 지연(delay)이 눈에 띄게 발생했다.

**해결책**: 왼쪽 패널의 모든 입력은 두 부류로 나뉜다.

- **가벼운 즉시 미리보기** — `refreshFeePreview()`, `markDirty()`, `updateNextBuyOptions()` 같은 함수. 할인 계산 결과 박스, T우주 이용금액 박스, "월 할부금" 텍스트, 콤마 포맷팅처럼 DOM 몇 개만 건드리는 작업은 즉시 반영된다.
- **무거운 전체 재계산** — `update()` (= `buildTimeline()` + `renderTable()`). 이제 이 함수는 다음 경우에만 호출된다.
  1. 페이지 최초 로드 시 (`DOMContentLoaded`)
  2. **"▶ 오른쪽 표에 반영" 버튼**(`#apply-btn`)을 눌렀을 때
  3. 표 안에서 **직접** 상호작용할 때 — 구독 슬롯 드롭다운 선택(`onCellSvcChange`), 연간/월간 토글(`onCellModeChange`), Google One 업그레이드 확정/취소, JSON 불러오기. 이런 액션들은 "왼쪽 패널 입력"이 아니라 표 자체를 조작하는 행위이므로 사용자가 즉시 결과를 보고 싶어한다고 판단해 그대로 즉시 반영하게 뒀다.

왼쪽 패널 입력이 바뀌면 `markDirty()`가 `#apply-hint`("입력값이 변경되었습니다…") 문구를 보여주고, `update()`가 실행되면 `clearDirty()`가 그 문구를 지운다.

**다음 개발자가 새 입력 필드를 추가할 때 지켜야 할 규칙**: 그 필드가 "왼쪽 설정 패널" 안에 있다면 `oninput`/`onchange`에 `update()`를 직접 걸지 말고 `markDirty()`(필요하면 `refreshFeePreview()`나 다른 가벼운 갱신 함수와 함께)를 걸 것. 표 내부 상호작용이라면 바로 `update()`를 걸어도 된다.

### 4-2. 단말기 할부 — 일할 계산과 재구입 주기

**문제 정의**: 스마트폰을 월 중간에 사면 그 달은 하루 단위로 계산한 요금만 청구되고, 못 걷은 차액은 나중에 청구되어야 한다. 그리고 "다음 스마트폰은 언제부터 다시 살 수 있는가"도 할부 개월수에 따라 달라진다.

**일할 계산 공식** (`addDevice()` 함수, `buildTimeline()` 내부):

```
factor = (30 - 구입일) / 30        // 30일 기준, 0~1로 clamp
firstAmt = round(월 할부금 × factor)   // 구입월 청구액
extraAmt = 월 할부금 - firstAmt        // 못 걷은 차액 → 별도 달에 청구
```

예: 120만원 / 12개월 (월 10만원)을 1월 10일에 구입
- 1월: 10만원 × (30-10)/30 = 6.67만원 청구
- 2~12월: 10만원씩 정상 청구 (11개월)
- **13번째 달(다음 해 1월)**: 차액 3.33만원을 별도로 청구

이 "13번째 달"은 `addDevice()` 안에서 `touch(addM(buyKey, months), extraAmt, '할부잔액', false)`로 항상 만들어진다. 즉, 구입일이 1일이 아닌 이상(사실상 항상, 1일에 사도 factor는 29/30이라 잔액이 생김) **할부 개월수보다 항상 1개월 더 긴 기간**에 걸쳐 청구가 끝난다.

**재구입 주기 계산** (`computeBuyGap()` 함수) — 여기가 가장 많이 수정된 부분이라 특히 신경써서 읽을 것:

```js
function computeBuyGap(installMonths) {
  const minNextOffset = 7; // 최소 재구입 기한: 구입월+6개월 경과 후(=7번째 달)부터
  return installMonths >= 10
    ? Math.max(installMonths, minNextOffset)       // 10개월 이상: 할부 개월수 그대로
    : Math.max(installMonths + 1, minNextOffset);  // 6개월: +1개월 (잔액 정산 달까지 기다림)
}
```

두 갈래로 나뉘는 이유:

- **할부 6개월**: "최소 재구입 기한(구입월+6개월 경과)"을 채우려면 정확히 7번째 달부터 가능하다. 6개월 할부는 정확히 6개월째에 딱 맞아떨어지지 않고(6 < 7), 위에서 설명한 "13번째 달=여기선 7번째 달" 잔액 청구가 있으므로, 재구입은 잔액 정산이 끝난 **다음 달**(구입월+7)부터 가능하다. 예: 2월 구입 → 3~7월 정상 청구, 8월 잔액 청구, **9월 1일부터 재구입**.
- **할부 10개월 이상**: 이미 최소 6개월 기한을 넘기므로, 할부 개월수가 끝나는 즉시(구입월+installMonths) 재구입할 수 있다. 이때 이전 기기의 남은 잔액(`extraAmt`)과 새 기기의 첫 달 일할 계산분(`firstAmt`)이 **같은 달**에 자동으로 합산되어 청구된다 — `touch()` 함수가 `deviceMap[k].installAmount`에 금액을 계속 더해나가는 구조라서, 별도 로직 없이 "같은 키에 두 번 touch되면 자연히 합산됨"이라는 성질만으로 이 요구사항이 충족된다. 예: 8월 구입·12개월 할부 → **다음 해 8월**에 바로 재구입 가능, 그 달 청구액 = 이전 기기 잔액 + 새 기기 첫 달 일할분.

두 번째, 세 번째... 기기도 동일한 `buyGap` 간격으로 반복 구매된다(`buildTimeline()`의 `for (let iter = 0; iter < 20 ...)` 루프). 재구입일의 "일(day)"은 항상 첫 구입일과 같은 날짜를 사용한다(별도 입력 없음).

**중복(⚠) 표시**: 한 달에 서로 다른 기기(deviceId)가 걸쳐 있으면 `deviceMap[k].deviceIds.size > 1`이 되고, 표에 "⚠ 중복"이 빨간 글씨로 표시된다. 10개월 이상 할부에서 재구입 달마다 항상 뜨는 정상적인 표시이며(잔액+새 일할분이 합산된 것뿐), 진짜 이상 상황(예: 사용자가 할부 기간보다 훨씬 짧은 주기로 여러 대를 겹쳐 사는 경우)과 구분하지 않는다. 필요하면 라벨 문구만 상황에 따라 다르게 바꾸는 것도 고려할 수 있다(현재는 안 바꿈).

### 4-3. 휴대전화 요금제 선택 — 실제 SKT 요금표 반영

`SKT_PLANS` 배열(약 134개 항목)은 사용자가 제공한 SKT 요금제 엑셀에서 추출한 실제 데이터다. 각 항목은 `{id, name, fee(월정액), disc(선택약정 반영가), link(tworld.co.kr 상세 페이지)}` 형태다.

**드롭다운이 아니라 콤보박스인 이유**: 처음엔 검색창 아래 리스트가 항상 펼쳐져 있었는데, 사용자가 "드롭다운처럼 접혀 있어야 한다"고 요청해서 `.plan-list`에 `display:none` 기본값을 주고, 검색창 focus/input 시에만 `.open` 클래스로 펼치도록 바꿨다(`openPlanList()`/`closePlanList()`, 문서 전체 클릭 리스너로 바깥 클릭 시 닫힘).

요금제를 선택하면(`selectPlan()`):
1. `#baseFee`(월정액) 입력칸에 정가를 채운다 (사용자가 이후 직접 수정 가능 — "월정액 (수정 가능)" 라벨).
2. **요금제명에 T우주 그룹과 일치하는 괄호 항목이 있으면**(`applyPlanToTuju()`) T우주 결합상품 섹션의 그룹/등급을 자동으로 맞춘다. 예: "베스트 Max(넷플릭스)"를 고르면 T우주 그룹=넷플릭스, 등급=Max로 자동 세팅.
3. "요금제 상세보기" 버튼이 활성화되고, 누르면 `link`(tworld.co.kr) 새 탭으로 열림.

### 4-4. 할인 계산식

`computeDiscountedFee(baseFee)` — 세 가지 할인을 조합한다. **세 할인 모두 "기본료(baseFee)"를 기준으로 각자 독립적으로 금액을 계산한 뒤, 그 금액들을 기본료에서 빼는 방식**이다(순차적으로 곱해나가는 복리식이 아님):

```
선택약정할인액 = 기본료 × 25%                          (체크박스, 고정 25%)
결합할인액     = 기본료 × 입력한 %                      (체크박스 + % 입력칸)
복지할인액     = (기본료 - 결합할인액) × 35%             (체크박스, 고정 35%, 결합할인 적용 후 금액 기준!)

최종 청구 기본료 = 기본료 - 선택약정할인액 - 결합할인액 - 복지할인액   (0원 하한)
```

복지할인만 "결합할인을 뺀 금액"을 기준으로 계산하는 게 핵심 포인트다 — 이 부분을 실수로 기본료 그대로 곱하면 안 된다.

### 4-5. T우주 결합상품 계산기

SKT의 "T우주" 결합 상품(휴대폰 요금제 + Google AI/넷플릭스/디즈니+/티빙&웨이브 등 OTT를 묶어 할인해주는 상품) 안내 이미지 4장(AI/넷플릭스/디즈니+/티빙&웨이브 요금제 상세)을 보고 데이터를 그대로 코드화했다.

**데이터 구조 3종**:

- `OTT_TIER_PRICES` — 유튜브/넷플릭스/디즈니+/티빙/웨이브 각각 3개 등급(tier1=프리미엄급, tier2=스탠다드급, tier3=광고형급)의 정가. "추가 OTT 서비스 선택" 드롭다운(다른 카테고리 서비스를 얹을 때)에 쓰인다.
- `TUJU_OWN_PRICES` — "멤버십 등급 선택"(그 그룹 자체의 서비스) 가격표. AI/넷플릭스/디즈니+는 위 `OTT_TIER_PRICES`를 그대로 재사용하지만, **티빙&웨이브는 결합 전용 가격 체계**(17,900/13,900/6,500원)를 따로 갖고 있다 — 개별 티빙(16,000원)이나 개별 웨이브(13,900원)와는 다른 숫자이므로 절대 섞어 쓰면 안 된다.
- `TUJU_GROUPS` — 그룹(ai/netflix/disney/tvingwavve)별로 요금제 등급(max/pro/p109/p99/p89)마다 최대할인 캡(`capNormal`=평시, `capPromo`=~2026.12.31 프로모션 기간)을 정의. `planName`은 `SKT_PLANS`의 실제 요금제명과 정확히 일치해야 하는 필드(4-3의 양방향 연동에 쓰임). `p109/p99/p89` 등급은 `hasAddon:false`로 고정 서비스 하나만 쓰고(`fixedTier`), Max/Pro만 "멤버십 등급 + 추가 OTT" 두 개를 선택할 수 있다.

**이용금액 계산 공식** (`computeTujuUsage()`), 4장의 이미지에서 역산해서 검증한 공식:

```
합산 정가 = 멤버십 등급 가격 + 추가 OTT 가격        (p109/p99/p89는 고정 서비스 가격 하나)

// Max/Pro/p109/p99 (프로모션 있음):
일반 이용금액   = max(합산 정가 - capNormal, 1000)
프로모션 이용금액 = max(합산 정가 - capPromo, 0)

// p89 (프로모션 대상 아님, percent 필드 존재):
이용금액 = round(합산 정가 × (1 - 0.5))   // 50% 정률 할인
```

`getTujuFee()`는 오늘 날짜가 `PROMO_DEADLINE`(2026-12-31) 이전이면 프로모션가를, 이후면 일반가를 택해서 반환하고, 이 값이 `buildTimeline()`의 `billFee`(청구요금)에 더해진다.

**양방향 동기화**: 요금제 선택 → T우주 그룹/등급 자동 설정(`applyPlanToTuju`), T우주 그룹/등급 변경 → 요금제 자동 선택(`applyTujuToPlan`). 서로가 서로를 부르면 무한루프가 나므로 `syncingTuju` 플래그로 한쪽이 실행 중일 때는 반대 방향 동기화를 건너뛴다. `applySettings()`(JSON 불러오기)도 복원 도중에는 이 플래그를 켜 둔다.

### 4-6. 구독 슬롯 시스템 (원본 설계, 거의 그대로 유지)

표의 "구독 1~4" 4개 컬럼은 각 달·각 슬롯이 완전히 독립적인 상태를 가진다 (`cellState[YYYYMM][slotIndex]`). 이 부분은 이번 작업에서 거의 손대지 않은 기존 로직이다.

- 슬롯에서 서비스를 "연간" 결제로 고르면 그 달에 연간 금액이 청구되고, 이후 11개월은 "유효기간"으로 표시되며 드롭다운이 사라진다(`in_period` 타입).
- 유효기간이 끝난 달에 다시 드롭다운이 나타나 새 서비스를 고를 수 있다.
- Google One 계열 서비스는 유효기간 중 상위 요금제로 "업그레이드"할 수 있고, 남은 개월수만큼 비례 크레딧을 계산해서 추가 결제액을 보여준다(`onSetUpgrade`/`onConfirmUpgrade`/`findAnnualStart`).
- 같은 달의 다른 슬롯이 이미 고른 서비스는 드롭다운에서 자동으로 제외된다(`buildSubOptions`).
- "브릿지" 표시(보라색 "⚡ 브릿지 구간")는 직전 연간 구독이 끝났는데 그 달에 단말 할부가 남아있는 경우에 뜨는 안내 문구일 뿐, 아무 로직도 강제하지 않는다.

---

## 5. 이번 작업 세션에서 삭제/변경된 것 (예전 스펙과 달라진 점)

원래 초기 스펙 문서(`subscription_planner_spec.md`, 이 문서에는 포함하지 않았지만 대화 초반에 참고했던 기획서)에는 있었지만 이번 작업 중 사용자 요청으로 제거되거나 완전히 대체된 기능들:

| 예전 기능 | 처리 |
|---|---|
| SKT T우주 번들(AI Max/Netflix Max 등 가상의 번들 4종, `TL_SKT_BUNDLES`) | **완전히 제거**. 실제 SKT 요금제(`SKT_PLANS`)와 실제 T우주 결합상품 계산기(`TUJU_GROUPS`)로 대체됨 |
| 요약 통계 카드 3개(구독료 총 지출/절약액/한도초과 달 수) | **완전히 제거** (사용자가 화면에서 삭제 요청) |
| "Google One 연간 시작 시점" 카드, "기타 추가 구독(브릿지 설정)" 카드 | **완전히 제거**. `googleStartMonth`는 `startOffset:7` 고정값으로 대체 |
| "다음 구입 예정 월" 수동 선택 드롭다운 | **완전히 제거**. 항상 자동 계산(`computeBuyGap`)으로만 동작 |
| 기본 조건 카드 안의 "휴대전화 기본 요금"/"부가서비스" | 휴대전화 요금 카드로 이동 + 실제 요금제 선택 방식으로 재설계 |
| 단말 구입 "연/월" 선택 | "구입일"(`<input type="date">`, 일 단위) 로 교체 → 일할 계산 가능해짐 |

---

## 6. 주요 데이터 구조

```js
SVC_CATALOG        // 구독 서비스 21종 (Google One 5 / OTT 5 / 음악 4 / 도서 2 / 게임 5)
                   // {id, name, cat, annual, monthly, color}

SKT_PLANS          // SKT 실제 요금제 134종 (첨부 엑셀에서 추출)
                   // {id, name, fee, disc, link}

OTT_TIER_PRICES    // T우주 "추가 OTT" 가격표: {youtube|netflix|disney|tving|wavve: {tier1,tier2,tier3}}
TUJU_OWN_PRICES    // T우주 "멤버십 등급" 가격표: {ai|netflix|disney|tvingwavve: {tier1,tier2,tier3}}
TUJU_GROUPS        // T우주 그룹/등급 정의(캡 할인액, addon 가능 카테고리, planName 등)

cellState          // 구독 슬롯 상태: cellState[YYYYMM][0~3] = {svcId, mode, upgradeKey, upgradeToId}
addonList          // 부가서비스 목록: [{name, fee}, ...]  (최소 1행 유지)
deviceMap          // buildTimeline() 내부 지역변수: {YYYYMM: {installAmount, labels, isBuyMonth, deviceIds}}
selectedPlanId     // 현재 선택된 SKT_PLANS의 id (전역)
syncingTuju        // 요금제↔T우주 동기화 재귀 방지 플래그 (전역)
```

---

## 7. 함수 레퍼런스 (역할별)

### 설정값 읽기/쓰기
| 함수 | 역할 |
|---|---|
| `getSettings()` | DOM에서 모든 설정값을 읽어 객체로 반환 (buildTimeline의 입력) |
| `getBuyDateParts()` | `#buyDate`(yyyy-mm-dd)를 `{year,month,day}`로 파싱 |
| `numVal(id)` | 콤마 포맷된 입력칸에서 숫자만 뽑아 정수로 반환 |
| `formatNumberInput(el)` | 입력값에서 숫자만 남기고 1,000단위 콤마를 붙여 표시 |

### 지연 반영(적용 버튼) 관련
| 함수 | 역할 |
|---|---|
| `update()` | **무거운** 전체 재계산(`buildTimeline`+`renderTable`) + `clearDirty()` |
| `refreshFeePreview()` | **가벼운** 미리보기 — 할인 후 기본료 표시 + T우주 결과 박스 + `markDirty()` |
| `markDirty()` / `clearDirty()` | "표에 반영 안 된 변경사항 있음" 힌트(`#apply-hint`) 표시/숨김 |

### 요금제/할인/T우주
| 함수 | 역할 |
|---|---|
| `selectPlan(id)` / `planById(id)` / `planByName(name)` | SKT_PLANS 선택 및 조회 |
| `renderPlanList()` / `openPlanList()` / `closePlanList()` / `onPlanFilterInput()` | 요금제 콤보박스 렌더링/열기/닫기 |
| `openPlanDetail()` | 선택된 요금제의 tworld.co.kr 링크를 새 탭으로 열기 |
| `computeDiscountedFee(baseFee)` | 선택약정/결합/복지 3중 할인 적용 |
| `onDiscToggle(prefix)` | 결합할인 % 입력칸 활성/비활성 토글 |
| `onTujuGroupChange()` / `onTujuTierChange()` | T우주 그룹/등급 select 변경 시 하위 select들 재구성 |
| `computeTujuUsage()` / `getTujuFee()` / `renderTujuResult()` | T우주 이용금액 계산 및 결과 박스 렌더링 |
| `tujuKeyForPlanName()` / `applyPlanToTuju()` / `applyTujuToPlan()` | 요금제↔T우주 양방향 동기화 |

### 단말 할부
| 함수 | 역할 |
|---|---|
| `computeBuyGap(installMonths)` | 재구입까지의 개월수 계산 (6개월 vs 10개월 이상 분기) |
| `updateNextBuyOptions()` | "월 할부금" 표시 + "다음 구입 예정" 안내 문구 갱신 (가벼움, 표 재계산 아님) |
| `addDevice()` (buildTimeline 내부 지역함수) | 구입일 기준 일할 계산 + 정상 청구 + 잔액 청구를 deviceMap에 기록 |

### 타임라인 계산/렌더링
| 함수 | 역할 |
|---|---|
| `buildTimeline()` | 2026~2030년 월별 행(rows) 배열 생성 — 이 프로젝트의 핵심 함수 |
| `renderTable(rows)` | rows를 받아 `<tbody>` HTML 문자열로 렌더링 |
| `buildSubOptions(key, si, currentSvcId)` | 특정 달·슬롯의 구독 드롭다운 옵션 생성 (다른 슬롯 선택 제외) |
| `getCellState()` / `setCellState()` | 셀 상태 read/write |
| `onCellSvcChange()` / `onCellModeChange()` | 구독 슬롯 드롭다운/연간·월간 버튼 이벤트 (즉시 `update()`) |
| `isGoogleSvc()` / `googleUpgradeOptions()` / `onSetUpgrade()` / `onConfirmUpgrade()` / `onCancelUpgrade()` / `findAnnualStart()` / `findAnnualStartState()` | Google One 업그레이드 플로우 |

### 부가서비스
| 함수 | 역할 |
|---|---|
| `addAddonRow(idx)` / `removeAddonRow(idx)` | 부가서비스 행 추가/삭제 (+/− 버튼, 마지막 한 줄은 삭제 대신 비우기) |
| `renderAddonList()` / `getTotalAddonFee()` | 부가서비스 목록 렌더링 / 합계 계산 |

### 저장/불러오기
| 함수 | 역할 |
|---|---|
| `collectSettings()` / `applySettings(cfg)` | 설정값 ↔ JSON 직렬화 객체 변환 |
| `saveToJson()` / `loadFromJson(event)` | 파일 다운로드 / 파일 읽어서 복원 (불러오기는 즉시 `update()`) |

---

## 8. JSON 저장 포맷

```json
{
  "version": 1,
  "savedAt": "2026-07-13T12:00:00.000Z",
  "settings": {
    "limit": "297,000",
    "baseFee": "129,000",
    "selectedPlanId": "NA00009815",
    "discSuntaek": true,
    "discCombiChk": false,
    "discCombiPct": "0",
    "discWelfareChk": false,
    "tujuGroup": "netflix",
    "tujuTier": "max",
    "tujuOwnTier": "tier1",
    "tujuAddon": "youtube|tier1",
    "addonList": "[{\"name\":\"FLO\",\"fee\":\"9000\"}]",
    "installPrincipal": "1,200,000",
    "installMonths": "12",
    "buyDate": "2026-08-01"
  },
  "cellState": {
    "202608": [
      { "svcId": "g_aiplus", "mode": "annual", "upgradeKey": null, "upgradeToId": "" },
      { "svcId": "", "mode": "annual", "upgradeKey": null, "upgradeToId": "" },
      { "svcId": "", "mode": "annual", "upgradeKey": null, "upgradeToId": "" },
      { "svcId": "", "mode": "annual", "upgradeKey": null, "upgradeToId": "" }
    ]
  }
}
```

숫자 필드(`limit`, `baseFee`, `installPrincipal`)는 콤마가 포함된 **문자열 그대로** 저장된다. 읽어들일 때 `numVal()`이 콤마를 제거하고 파싱하므로 그대로 다시 넣어도 문제없다.

---

## 9. 타임라인 표 컬럼 / 색상 규칙

| # | 컬럼 | 설명 |
|---|---|---|
| 1 | 월 | 연도 구분행 + 월 + 배지(구입/단말0원/브릿지) |
| 2 | 청구요금 | `할인 후 기본료 + T우주 이용금액 + 부가서비스 합계` (`billFee`) |
| 3 | 부가서비스 | 부가서비스 합계만 별도 표시 (2번 컬럼과 중복 표기, 내역 확인용) |
| 4 | 단말 | 그 달 할부 청구액, 두 기기 겹치면 "⚠ 중복" 빨간 글씨 |
| 5~8 | 구독 1~4 | 셀별 독립 드롭다운 (4-6절 참고) |
| 9 | 합계 | `청구요금 + 단말 + 구독비용 합` |
| 10 | 잔여금 | `지원한도 - 합계`. 초록(여유)/황색(빠듯, 0~2만원)/빨강(초과) |

행 배경색: 잔여금 초과(연빨강) > 단말 0원 달(연초록) > 브릿지 구간(연보라) 순으로 우선 적용.

---

## 10. 알려진 제약사항 & 향후 개선 아이디어

1. **상태 비영속** — `cellState`, `addonList`, `selectedPlanId` 등은 새로고침하면 초기화됨. JSON 저장/불러오기로만 보존 가능. `localStorage` 자동 저장을 붙이면 좋아질 부분.
2. **재구입 3대째 이후** — 2대, 3대, 4대... 모두 동일한 `installMonths`/`installPrincipal`/`buyGap`으로 반복 구매되는 것으로 가정한다. 기기마다 스펙이 달라지는 시나리오는 지원하지 않음.
3. **표시 기간 고정** — 2026년(구입월 기준 최대 7개월 전)부터 2030년 12월까지로 하드코딩(`inRange()`, `startOffset:7`). 범위를 바꾸려면 `buildTimeline()`의 `inRange()`와 `getSettings()`의 `startOffset`을 함께 수정해야 함.
4. **"⚠ 중복" 표시가 다소 과잉 경고처럼 보일 수 있음** — 10개월 이상 할부에서 재구입 달마다 정상적으로 뜨는데, 진짜 우발적 중복(사용자가 극단적으로 짧은 주기를 강제한 경우—현재 UI로는 불가능하지만 코드 구조상 이론적으로 가능)과 구분하지 않는다. 필요하면 라벨을 상황별로 나눌 수 있음.
5. **T우주 계산기의 promo 판정이 실행 시점의 실제 날짜(`new Date()`) 기준** — 2026-12-31이 지나면 자동으로 "일반가"로 전환된다. 프로모션 기간이 연장되면 `PROMO_DEADLINE` 상수만 바꾸면 됨.
6. **Google One 업그레이드 역탐색(`findAnnualStart`)은 최대 11개월 전까지만 탐색** — 연간 결제 12개월 갱신 주기 내에서만 정상 동작. 갱신 주기를 넘는 예외 상황은 처리 안 됨(원본 설계부터 있던 제약).
7. **부가서비스는 정액 고정** — 첫 달부터 매달 동일 금액이 청구되는 것으로 가정, 기간 한정 부가서비스는 지원 안 함.

---

## 11. 배포 정보

- **GitHub**: `chinsungpark/SKT-planner`, 작업 브랜치 `claude/mobile-plan-card-redesign-77p5zy`
- **Netlify**: 사이트명 `skt-planner` (`http://skt-planner.netlify.app`), 위 GitHub 브랜치에 연결되어 push 시 자동 배포됨
- 정적 사이트라 빌드 커맨드 없음, publish directory는 저장소 루트, `_redirects`로 `/` → `/subscription_planner.html` 리다이렉트

---

## 12. 참고 — 핵심 계산 검증 케이스 (테스트 시나리오로 재사용 가능)

```
케이스 1: 일할 계산 (6개월 할부)
조건: 원금 600,000원(월 100,000원), 2월 1일 구입
결과: 2월 96,667원(=100,000×29/30) → 3~7월 100,000원씩 → 8월 3,333원(잔액) → 9월 1일 재구입

케이스 2: 일할 계산 + 재구입 합산 (12개월 할부)
조건: 원금 1,200,000원(월 100,000원), 8월 1일 구입
결과: 8월 96,667원 → 9~7월(11개월) 100,000원씩 → 다음해 8월 재구입,
      그 달 청구액 = 이전 기기 잔액(3,333원) + 새 기기 일할분(96,667원) = 100,000원

케이스 3: 할인 계산
조건: 기본료 129,000원, 선택약정 체크, 결합할인 10%, 복지할인 체크
결과: 선택약정 32,250원 + 결합 12,900원 + 복지(=(129,000-12,900)×35%=40,635원)
      → 129,000 - 32,250 - 12,900 - 40,635 = 43,215원

케이스 4: T우주 결합상품
조건: AI 그룹, Max 등급, 멤버십=구글AI Pro(26,900원), 추가OTT=유튜브 프리미엄(14,900원)
결과: 합산 정가 41,800원 → 일반 이용금액 7,800원(41,800-34,000) → 프로모션 6,800원(41,800-35,000)
```

---

*이 문서는 2026-07-13 기준 코드 상태를 반영해서 작성됨. 이후 수정 시 이 문서도 같이 갱신할 것.*
