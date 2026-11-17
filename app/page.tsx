/*
  S01 홈 (0.58.0, 2026-11-16 마루님 "썰렁하고 의미가 없어서") : 내 여행 상황에 따라 내용이 바뀐다
  - 여행 중 > 7일 안에 떠날 여행 > 막 다녀온 여행(끝난 지 14일 안) > 다가오는 여행 > 여행 없음 순서로 하나만 고른다
  - 여행 전 : 출발까지 남은 날 + 남은 준비 + 이번 여행에서 열릴 도장
  - 여행 중 : 오늘 도장 받기 + 다음 장소 + 빠른 버튼(경비, 장소) + 오늘 일정
  - 여행 후 : 이번 여행에서 받은 도장 + 남은 정산 + 다음 여행 만들기
  - 여행 없음 : 여행 만들기 큰 카드 + 도장 받는 법
  - 맨 아래 : 수집 현황 한 줄 (도장 탭으로)
  여행 탭(지도, 목록)과 도장 탭(도감)에 있는 것은 되풀이하지 않는다
*/
import { FlashToast } from "@/components/toast";
import Link from "next/link";
import { Icon, PinCard, StampFace } from "@/components/kit";
import { AppShell, Logo, Avatar, MainTabs, MockNote } from "@/components/screen";
import { getViewer, isIn, initialOf, avatarOf } from "@/lib/viewer";
import { upcomingOf, pastOf, statusOf, daysBetween, todayOf, periodText, md, type Trip, type Item } from "@/lib/mock";
import { loadTrips, loadTrip, loadStamps, loadUnreadCount, loadPrep, loadExpenses, loadTripBook, type StampCard } from "@/lib/trips";
import { StampClaim } from "@/components/stamp-claim";
import { ProfileMenu } from "@/components/profile-menu";
import { settle, toKrw, isMixed } from "@/lib/settle";
import { formatMoney, flagOf, decimalsOf } from "@/lib/countries";
import { mapsDirUrl, canMap } from "@/lib/maps-link";
import { nextGoal, goalValue } from "@/lib/stamp-goals";
import type { Viewer } from "@/lib/viewer";

function Header({ loggedIn, initial, avatar, unread = 0, name, email }: { loggedIn: boolean; initial: string; avatar: string | null; unread?: number; name?: string; email?: string }) {
  return (
    <header className="flex items-center justify-between px-5 pb-2 pt-4">
      <Link href="/" aria-label="홈" className="flex h-11 items-center"><Logo /></Link>
      {loggedIn ? (
        <div className="flex items-center gap-1">
          <Link href="/notifications" aria-label={unread ? `알림, 안 읽은 알림 ${unread}개` : "알림"} className="press relative flex size-11 items-center justify-center rounded-full text-ink-sub transition-colors hover:bg-ink/5 hover:text-ink" /* 마우스를 올리면 살짝 켜진 느낌 (2026-11-17 마루님) */>
            <Icon name="bell" size={22} />
            {unread > 0 && <span aria-hidden className="absolute right-2 top-2 size-2.5 rounded-full bg-point ring-2 ring-bg" />}
          </Link>
          <ProfileMenu name={name ?? "나"} email={email ?? ""} face={<Avatar initial={initial} src={avatar} size={36} />}><Avatar initial={initial} src={avatar} /></ProfileMenu>
        </div>
      ) : (
        <Link href="/login" className="press inline-flex h-11 items-center rounded-full bg-surface px-4 text-sub font-bold text-ink">로그인</Link>
      )}
    </header>
  );
}

/* 카드 머리 : 제목 + 오른쪽 링크 */
function Head({ title, href, more }: { title: string; href?: string; more?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-body font-bold text-ink">{title}</h2>
      {href && <Link href={href} className="press inline-flex h-9 items-center gap-0.5 text-tiny font-semibold text-ink-sub">{more ?? "전체 보기"}<Icon name="right" size={14} /></Link>}
    </div>
  );
}

/* 봉인 도장 (도장 탭과 같은 모양을 작게) */
function Sealed({ name, country }: { name: string; country: string }) {
  const flag = flagOf(country);
  return (
    <li className="flex w-[72px] flex-none flex-col items-center gap-1.5 text-center">
      <span className="relative flex size-14 items-center justify-center rounded-full border-2 border-dashed border-point bg-bg">
        <span className="text-title font-extrabold text-point">?</span>
      </span>
      <span className="flex items-center gap-1 text-tiny font-bold text-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {flag && <img src={flag} alt="" width={12} height={12} className="rounded-sm" />}{name}
      </span>
    </li>
  );
}

const nowIn = (tz?: string) => {
  try { return new Intl.DateTimeFormat("en-GB", { timeZone: tz ?? "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()); }
  catch { return "00:00"; }
};

/* ───── 여행 전 ───── */
async function Before({ v, trip, today, missing }: { v: Viewer; trip: Trip; today: string; missing: StampCard[] }) {
  const left = daysBetween(today, trip.start);
  const prep = v.kind === "user" ? await loadPrep(v, trip.id) : null;
  const items = prep?.items ?? [];
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const todo = items.filter((i) => !i.done).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "reservation" ? -1 : 1));
  const resLeft = todo.filter((i) => i.kind === "reservation").length;
  const sealed = missing.filter((m) => m.next?.tripId === trip.id);
  return (
    <>
      <h1 className="text-title-xl font-extrabold text-ink">
        {left === 1 ? <>{trip.cities[0]},<br /><span className="text-point-text">내일</span> 떠나요</>
          : <>{trip.cities[0]}까지<br /><span className="text-point-text">{left}일</span> 남았어요</>}
      </h1>

      {/* 티켓 모양 (여행 탭 다음 여행 카드와 같음) : 왼쪽 정보 | 점선 절취선과 위아래 반원 홈 | 오른쪽 D-day */}
      <Link href={`/trips/${trip.id}`} className="press relative flex items-stretch rounded-card bg-deep text-on-deep">
        <span className="min-w-0 flex-1 py-4 pl-5 pr-4">
          <span className="flex items-center gap-1.5 text-tiny font-semibold text-on-deep-sub"><Icon name="plane" size={14} />다음 여행</span>
          <span className="mt-1 block truncate text-title font-extrabold">{trip.title}</span>
          <span className="mt-1 block truncate text-tiny font-semibold text-on-deep-sub">{periodText(trip)}</span>
          {trip.members.length > 1 && (
            <span className="mt-2 flex -space-x-1.5">
              {trip.members.slice(0, 4).map((m, i) => <Avatar key={i} initial={m.initial} tone={m.tone} src={m.avatar} size={24} ring />)}
            </span>
          )}
        </span>
        <span aria-hidden className="relative w-0 border-l-2 border-dashed border-on-deep-sub/40">
          <span className="absolute -left-[11px] -top-[10px] size-5 rounded-full bg-bg" />
          <span className="absolute -bottom-[10px] -left-[11px] size-5 rounded-full bg-bg" />
        </span>
        <span className="flex w-[92px] flex-none flex-col items-center justify-center gap-0.5 px-2 py-4 text-center">
          <span className="text-tiny font-semibold text-on-deep-sub">출발까지</span>
          <span className="text-[26px] font-extrabold leading-tight text-point tabular-nums" /* 키 컬러 (2026-11-18 마루님) */>D-{left}</span>
        </span>
      </Link>

      {prep && (
        <section className="flex flex-col gap-3 rounded-card bg-surface p-4" aria-label="남은 준비">
          <Head title="남은 준비" href={`/trips/${trip.id}/prep`} more="준비 탭" />
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-point" style={{ width: `${Math.max(pct, 3)}%` }} /></div>
            <span className="text-tiny font-bold text-ink">{pct}%</span>
          </div>
          {items.length === 0 ? (
            <Link href={`/trips/${trip.id}/prep`} className="press flex min-h-11 items-center justify-between rounded-field bg-bg px-3 text-sub text-ink">
              예약과 체크리스트를 적어 두세요<Icon name="right" size={16} />
            </Link>
          ) : todo.length === 0 ? (
            <p className="text-sub font-semibold text-ink">준비를 모두 끝냈어요. 떠나기만 하면 돼요</p>
          ) : (
            <>
              <p className="text-tiny text-ink-sub">{resLeft ? `예약 ${resLeft}건, ` : ""}체크리스트 {todo.length - resLeft}개가 남았어요</p>
              <ul className="flex flex-col gap-1.5">
                {todo.slice(0, 3).map((i) => (
                  <li key={i.id}>
                    <Link href={i.kind === "reservation" ? `/trips/${trip.id}/bookings/${i.id}` : `/trips/${trip.id}/prep`}
                      className="press flex min-h-11 items-center gap-2.5 rounded-field bg-bg px-3 text-sub">
                      <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-bold ${i.kind === "reservation" ? "bg-point-soft text-point-text" : "bg-surface text-ink-sub"}`}>{i.kind === "reservation" ? "예약" : "체크리스트"}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-ink">{i.title}</span>
                      {i.due && <span className="flex-none text-tiny text-ink-sub">{md(i.due)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {sealed.length > 0 && (
        <section className="flex flex-col gap-3 rounded-card bg-surface p-4" aria-label="이번 여행에서 열릴 도장">
          <Head title="이번 여행에서 열릴 도장" href="/stamps" more="도장" />
          <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none]">
            {sealed.map((m) => <Sealed key={m.name} name={m.name} country={m.country} />)}
          </ul>
          <p className="text-tiny text-ink-sub">여행 기간에 그 도시에 가서 [도장 받기] 를 누르면 열려요</p>
        </section>
      )}
    </>
  );
}

/* ───── 여행 중 ───── */
async function During({ v, trip, today }: { v: Viewer; trip: Trip; today: string }) {
  const dayNo = daysBetween(trip.start, today) + 1;
  const full = await loadTrip(v, trip.id);
  const items: Item[] = "trip" in full ? full.trip.days[dayNo - 1]?.items ?? [] : [];
  const canEdit = "role" in full && full.role !== "viewer" && v.kind === "user";
  const now = nowIn(trip.timeZone);
  const next = items.find((i) => i.time && i.time >= now) ?? (items.some((i) => i.time) ? undefined : items[0]);
  const where = next ? { title: next.title, addr: next.addr, lat: next.lat, lng: next.lng, gpid: next.gpid } : null;
  return (
    <>
      <h1 className="text-title-xl font-extrabold text-ink">
        {trip.cities[0]} 여행<br /><span className="text-point-text">{dayNo}일째</span>예요
      </h1>

      {v.kind === "user" && <StampClaim tripId={trip.id} city={trip.cities[0]} inset={false} />}

      {next && where && (
        <section className="flex items-center gap-3 rounded-deep bg-deep px-5 py-4 text-on-deep" aria-label="다음 장소">
          <span className="min-w-0 flex-1">
            <span className="block text-tiny font-semibold text-on-deep-sub">다음 장소{next.time ? `, ${next.time}` : ""}</span>
            <span className="block truncate text-title font-bold">{next.title}</span>
          </span>
          {canMap(where) && (
            <a href={mapsDirUrl(where)} target="_blank" rel="noopener noreferrer"
              className="press inline-flex h-11 flex-none items-center gap-1 rounded-full bg-point px-4 text-sub font-bold text-white"><Icon name="pin" size={16} />길찾기</a>
          )}
        </section>
      )}

      {canEdit && (
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/trips/${trip.id}/expenses?add=1`} className="press flex h-14 items-center justify-center gap-1.5 rounded-card bg-surface text-sub font-bold text-ink"><Icon name="won" size={18} />경비 적기</Link>
          <Link href={`/trips/${trip.id}/places/new?day=${dayNo}`} className="press flex h-14 items-center justify-center gap-1.5 rounded-card bg-surface text-sub font-bold text-ink"><Icon name="plus" size={18} />장소 추가</Link>
        </div>
      )}

      <section className="flex flex-col gap-3" aria-label="오늘 일정">
        <Head title={items.length ? `오늘 일정 ${items.length}곳` : "오늘 일정"} href={`/trips/${trip.id}?day=${dayNo}`} more="전체 일정" />
        {items.length ? (
          <div>
            {items.map((it, i) => (
              <PinCard key={it.id ?? i} index={i + 1} time={it.time ?? ""} timeEnd={it.timeEnd} category={it.category} title={it.title}
                desc={it.desc ?? ""} photo={it.photos?.find((x) => !x.path.endsWith(".pdf"))?.url} photoCount={it.photos?.length} last={i === items.length - 1}
                href={canEdit && it.id ? `/trips/${trip.id}/places/${it.id}` : undefined} />
            ))}
          </div>
        ) : (
          <p className="rounded-card bg-surface px-4 py-5 text-center text-sub text-ink-sub">오늘은 아직 장소가 없어요</p>
        )}
      </section>
    </>
  );
}

/* ───── 여행 후 ───── */
async function After({ v, trip }: { v: Viewer; trip: Trip }) {
  const [book, exp] = v.kind === "user" ? await Promise.all([loadTripBook(v, trip.id), loadExpenses(v, trip.id)]) : [null, null];
  const got = book?.stamps ?? [];
  const me = exp?.me;
  const mine = exp ? settle(isMixed(exp.expenses) ? toKrw(exp.expenses, exp.rates, decimalsOf) : exp.expenses).filter((t) => t.from === me || t.to === me) : [];
  const nameOf = (id: string) => exp?.people.find((p) => p.userId === id)?.name ?? "함께한 사람";
  return (
    <>
      <h1 className="text-title-xl font-extrabold text-ink">{trip.cities[0]} 여행,<br /><span className="text-point-text">잘 다녀왔어요</span></h1>

      <section className="flex flex-col items-center gap-3 rounded-deep bg-deep px-5 py-5 text-center text-on-deep" aria-label="이번 여행에서 받은 도장">
        <p className="text-tiny font-semibold text-on-deep-sub">{trip.title}</p>
        {got.length ? (
          <>
            <ul className="flex flex-wrap justify-center gap-1">
              {got.slice(0, 4).map((s, i) => (
                <li key={s.name} style={{ transform: `rotate(${i % 2 ? 6 : -6}deg)` }}><StampFace name={s.name} country={s.country} size={72} /></li>
              ))}
            </ul>
            <p className="text-title font-extrabold">도장 <span className="text-point">{got.length}개</span>를 받았어요</p>
            <p className="text-tiny text-on-deep-sub">{got.map((s) => s.name).join(", ")}</p>
          </>
        ) : (
          <>
            <span className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-on-deep/40 text-title font-extrabold text-on-deep-sub">?</span>
            <p className="text-sub font-semibold">이번 여행에서는 도장을 받지 못했어요</p>
            <p className="text-tiny text-on-deep-sub">다음 여행에서는 도시에 도착하면 [도장 받기] 를 눌러 보세요</p>
          </>
        )}
      </section>

      {mine.length > 0 && (
        <section className="flex flex-col gap-3 rounded-card bg-surface p-4" aria-label="남은 정산">
          <Head title="남은 정산" href={`/trips/${trip.id}/expenses`} more="비용 탭" />
          <ul className="flex flex-col gap-1.5">
            {mine.map((t, i) => {
              const send = t.from === me;
              return (
                <li key={i} className="flex min-h-11 items-center justify-between gap-2 rounded-field bg-bg px-3 text-sub">
                  <span className="text-ink">{send ? `${nameOf(t.to)}님에게 보낼 돈` : `${nameOf(t.from)}님에게 받을 돈`}</span>
                  <span className={`font-extrabold ${send ? "text-point-text" : "text-ink"}`}>{formatMoney(t.amount, t.currency)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link href={`/trips/${trip.id}`} className="press flex h-14 items-center justify-center gap-1.5 rounded-card bg-surface text-sub font-bold text-ink"><Icon name="cal" size={18} />지난 일정 보기</Link>
        <Link href="/trips/new" className="press flex h-14 items-center justify-center gap-1.5 rounded-card bg-btn text-sub font-bold text-on-btn"><Icon name="plus" size={18} />다음 여행 만들기</Link>
      </div>
    </>
  );
}

/* ───── 여행 없음 ───── */
function Empty({ first }: { first: boolean }) {
  return (
    <>
      <h1 className="text-title-xl font-extrabold text-ink">어디로<br /><span className="text-point-text">떠나 볼까요?</span></h1>
      <Link href="/trips/new" className="press flex flex-col gap-4 rounded-deep bg-deep px-5 py-5 text-on-deep">
        <span className="flex size-12 items-center justify-center rounded-full bg-point text-white"><Icon name="plane" size={24} /></span>
        <span>
          <span className="block text-title font-extrabold">{first ? "첫 여행 만들기" : "다음 여행 만들기"}</span>
          <span className="mt-1 block text-sub text-on-deep-sub">도시와 날짜만 정하면 바로 시작해요. 함께 갈 사람도 초대할 수 있어요</span>
        </span>
        <span className="inline-flex h-11 items-center justify-center self-start rounded-full bg-point px-5 text-sub font-bold text-white">시작하기</span>
      </Link>
      <section className="flex flex-col gap-3 rounded-card bg-surface p-4" aria-label="도장 받는 법">
        <h2 className="text-body font-bold text-ink">여행하면 도장이 모여요</h2>
        <ol className="flex flex-col gap-2.5">
          {["여행을 만들고 도시를 넣어요", "여행 기간에 그 도시에 가요", "[도장 받기] 를 누르면 그 도시 도장이 열려요"].map((t, i) => (
            <li key={t} className="flex items-center gap-2.5 text-sub text-ink">
              <span className="flex size-6 flex-none items-center justify-center rounded-full bg-point text-tiny font-extrabold text-white">{i + 1}</span>{t}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ bye?: string }> }) {
  const { bye } = await searchParams;
  const viewer = await getViewer();
  const loggedIn = isIn(viewer);
  // 여행 목록, 도장, 안 읽은 알림은 서로 기다리지 않고 한꺼번에 (성능)
  const [trips, stamps, unread] = await Promise.all([loadTrips(viewer), loggedIn ? loadStamps(viewer) : null, loadUnreadCount(viewer)]);
  const next = upcomingOf(trips);
  const past = pastOf(trips);
  const ongoing = next.find((t) => statusOf(t, todayOf(t)) === "ongoing");
  const recent = past.find((t) => daysBetween(t.end, todayOf(t)) <= 14);
  const coming = next.find((t) => statusOf(t, todayOf(t)) === "upcoming");
  // 다음 여행이 7일 안이면 막 다녀온 여행보다 먼저 (2026-11-17 마루님 "곧 떠날 여행이 가려져요")
  const soon = coming && daysBetween(todayOf(coming), coming.start) <= 7 ? coming : undefined;

  const count = stamps?.earned.length ?? 0;
  const countries = stamps?.countryCount ?? 0;
  const goal = nextGoal(count, countries);

  return (
    <AppShell>
      <Header loggedIn={loggedIn} initial={initialOf(viewer)} avatar={avatarOf(viewer)} unread={unread} name={viewer.kind === "user" ? viewer.name ?? undefined : undefined} email={viewer.kind === "user" ? viewer.email : undefined} />
      {viewer.kind === "preview" && <MockNote />}
      {bye && <FlashToast message="탈퇴했어요. 그동안 KKuK를 써 주셔서 고마워요" param="bye" />}
      <div className="flex flex-col gap-3 px-5 pb-4 pt-4">
        {ongoing ? <During v={viewer} trip={ongoing} today={todayOf(ongoing)} />
          : soon || (coming && !recent) ? <Before v={viewer} trip={coming!} today={todayOf(coming!)} missing={stamps?.missing ?? []} />
          : recent ? <After v={viewer} trip={recent} />
          : <Empty first={trips.length === 0} />}
        {/* 곧 떠날 여행에 자리를 내준 막 다녀온 여행은 작은 줄로 (2026-11-17) */}
        {!ongoing && soon && recent && (
          <Link href={`/trips/${recent.id}`} className="press flex min-h-14 items-center gap-3 rounded-card bg-surface px-4 py-3">
            <span className="flex size-9 flex-none items-center justify-center rounded-full bg-surface-soft text-ink-sub"><Icon name="cal" size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-tiny text-ink-sub">막 다녀온 여행</span>
              <span className="block truncate text-sub font-bold text-ink">{recent.title}</span>
            </span>
            <Icon name="right" size={18} className="text-ink-sub" />
          </Link>
        )}

        {/* 수집 현황 한 줄 → 도장 탭 */}
        {loggedIn && (
          <Link href="/stamps" className="press mt-3 flex min-h-14 items-center gap-3 rounded-card bg-surface px-4 py-3">
            <span className="flex size-9 flex-none items-center justify-center rounded-full bg-point-soft text-point-text"><Icon name="stamp" size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sub font-bold text-ink">모은 도장 {count}개{countries ? `, 나라 ${countries}곳` : ""}</span>
              <span className="block text-tiny text-ink-sub">{goal ? `${goal.label}까지 ${goal.need - goalValue(goal, count, countries)}${goal.of === "stamp" ? "개" : "곳"} 남았어요` : "모든 목표를 이뤘어요"}</span>
            </span>
            <Icon name="right" size={18} className="text-ink-sub" />
          </Link>
        )}
      </div>
      <MainTabs active="홈" />
    </AppShell>
  );
}
