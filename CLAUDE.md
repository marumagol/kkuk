# 트립추얼(Triptual, 옛 KKuK) 코드 지도

> 일하는 규칙(스레드, 버전, 배포)은 프로젝트 파일 `/mnt/project-files/CLAUDE.md` 에 있어요. 이 파일은 "어느 코드를 보면 되는지"만 적어요. 파일을 뒤지기 전에 여기부터 보세요.

## 큰 파일 읽는 규칙 (통째로 읽지 않기)

| 파일 | 크기 | 읽는 법 |
|---|---|---|
| `lib/stamp-art.ts` | 83KB | 도장 그림 SVG 모음. `components/stamp-face.tsx` 에서만 import. **절대 통째로 읽지 않는다.** `grep -n '"JP:삿포로"'` 처럼 그 도시 줄만 |
| `lib/changelog.ts` | 66KB | 업데이트 내역. 새 항목은 맨 위에 추가하므로 `head -30` 만 |
| `app/actions.ts` | 64KB | 모든 서버 동작. `grep -n 'export async function 이름'` 으로 찾아 그 함수만 (`sed -n 'N,Mp'`) |
| `components/day-board.tsx` | 61KB | 일정 화면 본체. 필요한 부분을 grep 으로 찾아 그 근처만 |
| `lib/trips.ts` | 55KB | 화면용 데이터 읽기. 함수 이름으로 grep |
| `components/kit.tsx`, `place-form.tsx`, `expenses-panel.tsx`, `prep-panel.tsx` | 24~34KB | 바꿀 부분만 grep 으로 |

- 다른 파일도 20KB 가 넘으면 먼저 grep 으로 위치를 찾고, 그 부분만 읽는다
- 버전은 `package.json` 의 `"version"` 한 줄만 확인한다

## 화면 → 파일

| 화면 | 주소 | 주요 파일 |
|---|---|---|
| 홈 | `/` | `app/page.tsx`, `components/profile-menu.tsx`, `lib/stamp-goals.ts` |
| 여행 목록, 세계 지도 | `/trips` | `app/trips/page.tsx`, `components/world-trips.tsx`, `lib/iso-numeric.ts`, `public/geo/` |
| 여행 만들기/수정 | `/trips/new`, `/trips/[id]/edit` | `trip-create.tsx`, `trip-edit.tsx`, `city-editor.tsx`, `range-calendar.tsx`, `lib/countries.ts`, `lib/rules.ts` |
| 일정 | `/trips/[id]` | `day-board.tsx`, `day-map.tsx`, `trip-tabs.tsx`, `trip-menu.tsx`, `trip-back.tsx`, `live-refresh.tsx` |
| 장소 추가/수정 | `/trips/[id]/places/new`, `/places/[placeId]` | `place-form.tsx`, `place-search.tsx`, `memo-form.tsx`, `lib/place-fields.ts`, `lib/places.ts`(구글), `lib/hours.ts`, `lib/airlines.ts` |
| 준비 (체크리스트, 예약) | `/trips/[id]/prep`, `/bookings/[bid]` | `prep-panel.tsx`, `booking-form.tsx`, `booking-preview.tsx`, `swipe-row.tsx`, `bulk-select.tsx`, `file-viewer.tsx` |
| 비용 (예산, 경비, 정산) | `/trips/[id]/expenses` | `expenses-panel.tsx`, `budget-card.tsx`, `rate-dialog.tsx`, `currency-select.tsx`, `lib/budget.ts`, `lib/settle.ts`, `lib/fx.ts` |
| 함께하는 사람, 초대 | `/trips/[id]/members`, `/invite/[token]` | `members-panel.tsx`, `join-button.tsx` |
| 일정 공유 | `/trips/[id]/share`, 공개 `/s/[token]` | `day-share.tsx` |
| 여행 지도 | `/trips/[id]/map` | `trip-map.tsx` |
| 카드 (도장 받기, 모은 카드) | `/stamps` | `stamp-cards.tsx`, `stamp-face.tsx`(도장 그림, stamp-art 를 부르는 유일한 조각), `stamp-claim.tsx`, `hold-button.tsx`, `stamp-reveal.tsx`, `holo-card.tsx`, `goal-badges.tsx`, `lib/city-lore.ts`, `stamp-tester.tsx`, `lib/stamp-art.ts` |
| 설정 | `/me`, `/me/name`, `/me/trash`, `/me/updates`, `/me/withdraw` | `avatar-editor.tsx`, `avatar-cropper.tsx`, `theme-picker.tsx`, `push-toggle.tsx`, `restore-button.tsx`, `withdraw-form.tsx`, `update-seen.tsx` |
| 로그인, 처음 이름 | `/login`, `/auth/callback`, `/welcome` | `app/login/`, `name-form.tsx`, `lib/random-name.ts`, `lib/viewer.ts` |
| 알림 | `/notifications` | `read-all.tsx`, `clear-read.tsx` |
| 약관, 개인정보 | `/terms`, `/privacy` | `legal-page.tsx`, `lib/legal.ts` |

(파일 이름만 적은 것은 `components/` 안)

## 공통

- 디자인 토큰 `app/globals.css` (카드, 여권 연출 스타일은 `components/cards.css`, 카드 조각 4개만 import), 공통 조각 `components/kit.tsx` (도장 그림은 `stamp-face.tsx` 로 따로. kit 에서 `lib/stamp-art` 를 부르면 모든 화면이 100KB 무거워짐), 화면 틀/브랜드 `components/screen.tsx`, 아래 탭 `components/global-tabs.tsx`, 토스트 `components/toast.tsx`
- 로그인 확인과 둘러보기 얼럿 `components/gate.tsx`, 작성 중 나가기 경고 `leave-guard.tsx`, 오프라인 `network-banner.tsx`, `offline-saver.tsx`, `sw-register.tsx`, `public/sw.js`
- 로그인 세션 갱신 `middleware.ts`, 없앤 옛 주소 넘기기 `next.config.ts` redirects
- Supabase 클라이언트 `lib/supabase/`, 저장 실패 처리 `lib/safe-call.ts`, 그림 줄이기 `lib/image.ts`
- 미리보기(가짜 데이터) `lib/mock.ts`, 조각 모음 `/dev/kit` (SHOW_DEV_KIT=1 일 때만)
- DB : `supabase/migrations/` (번호 순), 검사 `supabase/tests/`, Edge Function `supabase/functions/`

## 검사

- `npx tsc --noEmit` 와 `npm run build` 가 통과하면 작은 수정은 끝 (캡처 없음)
