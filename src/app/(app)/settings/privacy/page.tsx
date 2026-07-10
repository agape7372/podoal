'use client';

import { useRouter } from 'next/navigation';
import { feedbackTap } from '@/lib/feedback';

// 개인정보처리방침 — docs/PRIVACY_POLICY_DRAFT.md의 게시본(2026-07-10 시행).
// 내용 개정은 문서(정본) 개정 → 이 페이지 반영 + 앱 내 공지 순서를 지킨다(제10조).

const 필수수집 = [
  { item: '이메일 주소', when: '이메일 가입 시', why: '계정 식별·로그인' },
  { item: '비밀번호(암호화 저장)', when: '이메일 가입 시', why: '계정 보안' },
  { item: '닉네임·프로필 아바타', when: '가입·프로필 수정 시', why: '서비스 내 표시' },
  { item: '소셜 로그인 식별자', when: '구글·카카오·네이버 로그인 시', why: '계정 연결(비밀번호 미수집)' },
];

const 생성정보 = [
  { item: '습관 기록(포도판·포도알·보상·메시지·타임캡슐 등)', why: '서비스 핵심 기능 제공' },
  { item: '업로드 이미지(보상 사진·커스텀 알 사진)', why: '이용자가 직접 등록한 콘텐츠 표시' },
  { item: '웹 푸시 구독 정보(브라우저 엔드포인트)', why: '이용자가 켠 알림 발송' },
];

const 국외이전 = [
  { label: '이전받는 자', value: 'PostHog, Inc.' },
  { label: '이전 국가·지역', value: '유럽연합(EU) — 프랑크푸르트 리전' },
  { label: '이전 항목', value: '익명화된 서비스 이용 이벤트(제1조 "선택" 항목)' },
  { label: '이전 방법', value: '서비스 이용 시 네트워크를 통한 전송' },
  { label: '보유 기간', value: '제3조와 동일(최대 24개월)' },
];

const 수탁자 = [
  { label: 'Vercel Inc.', value: '서비스 호스팅·이미지 저장' },
  { label: 'Neon Inc.', value: '데이터베이스 운영' },
  { label: 'PostHog, Inc.', value: '익명 이용 통계 처리(동의 시)' },
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-1.5">
      <span className="w-28 shrink-0 text-xs font-semibold text-warm-sub">{label}</span>
      <span className="flex-1 text-xs text-warm-text">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="clay p-5 mb-4">
      <h2 className="text-sm font-bold text-grape-700 mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="pb-4">
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => { feedbackTap(); router.push('/settings'); }}
          aria-label="설정"
          className="clay-button w-9 h-9 rounded-full flex items-center justify-center text-warm-sub shrink-0"
        >
          ←
        </button>
        <h1 className="font-display text-2xl font-bold text-grape-700">개인정보처리방침</h1>
      </div>

      <section className="clay p-5 mb-4">
        <p className="text-sm text-warm-text leading-relaxed">
          포도알(이하 &ldquo;서비스&rdquo;)은 이용자의 개인정보를 소중히 여기며,
          「개인정보 보호법」 등 관련 법령을 준수합니다.
        </p>
      </section>

      <Section title="1. 수집하는 개인정보 항목">
        <h3 className="text-xs font-semibold text-warm-sub mb-2">필수 (회원가입·서비스 제공)</h3>
        <div className="mb-4 divide-y divide-warm-border/55">
          {필수수집.map((r) => (
            <div key={r.item} className="py-2">
              <p className="text-xs font-medium text-warm-text">{r.item}</p>
              <p className="text-xs text-warm-sub mt-0.5">{r.when} — {r.why}</p>
            </div>
          ))}
        </div>
        <h3 className="text-xs font-semibold text-warm-sub mb-2">서비스 이용 과정에서 생성</h3>
        <div className="mb-4 divide-y divide-warm-border/55">
          {생성정보.map((r) => (
            <div key={r.item} className="py-2">
              <p className="text-xs font-medium text-warm-text">{r.item}</p>
              <p className="text-xs text-warm-sub mt-0.5">{r.why}</p>
            </div>
          ))}
        </div>
        <h3 className="text-xs font-semibold text-warm-sub mb-2">선택 (동의 시에만 — 익명 사용 통계)</h3>
        <div className="py-2">
          <p className="text-xs font-medium text-warm-text">
            익명화된 서비스 이용 이벤트(화면 이동·기능 사용 여부, 내부 식별자 기준)
          </p>
          <p className="text-xs text-warm-sub mt-0.5">서비스 개선·기능 우선순위 판단</p>
        </div>
        <ul className="mt-3 space-y-1.5 text-xs text-warm-sub list-disc pl-4">
          <li>이용 통계는 최초 실행 시 동의한 경우에만 수집합니다. 거절하거나 응답하지 않으면 아무것도 수집하지 않습니다.</li>
          <li>통계에는 이메일·닉네임·메시지 내용 등 개인을 알아볼 수 있는 정보를 포함하지 않습니다.</li>
        </ul>
      </Section>

      <Section title="2. 개인정보의 처리 목적">
        <ol className="space-y-1.5 text-xs text-warm-text list-decimal pl-4">
          <li>회원 관리: 가입·로그인·계정 식별·탈퇴 처리</li>
          <li>서비스 제공: 습관 기록·친구·응원·선물·알림 등 핵심 기능</li>
          <li>서비스 개선(동의 시): 익명 통계 기반 기능 개선</li>
        </ol>
      </Section>

      <Section title="3. 보유 및 이용 기간">
        <ul className="space-y-1.5 text-xs text-warm-text list-disc pl-4">
          <li>회원 정보·습관 기록: 회원 탈퇴 시 즉시 삭제 (탈퇴 시 계정과 연결된 데이터가 함께 삭제됩니다)</li>
          <li>익명 이용 통계: 수집일로부터 최대 24개월 보관 후 파기</li>
          <li>법령상 보존 의무가 있는 경우 해당 기간 동안 보존</li>
        </ul>
      </Section>

      <Section title="4. 개인정보의 국외 이전 (익명 이용 통계에 한함)">
        <p className="text-xs text-warm-text mb-2">
          동의한 이용자의 익명 사용 통계는 아래와 같이 국외에서 처리됩니다.
        </p>
        <div className="divide-y divide-warm-border/55">
          {국외이전.map((r) => <Row key={r.label} label={r.label} value={r.value} />)}
        </div>
        <p className="text-xs text-warm-sub mt-3">동의를 거절해도 서비스 이용에는 어떠한 제한도 없습니다.</p>
      </Section>

      <Section title="5. 개인정보의 제3자 제공">
        <p className="text-xs text-warm-text">
          서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다. (제4조의 익명 통계 위탁 처리 제외)
        </p>
      </Section>

      <Section title="6. 처리 위탁">
        <div className="divide-y divide-warm-border/55">
          {수탁자.map((r) => <Row key={r.label} label={r.label} value={r.value} />)}
        </div>
      </Section>

      <Section title="7. 이용자의 권리와 행사 방법">
        <ul className="space-y-1.5 text-xs text-warm-text list-disc pl-4">
          <li>열람·정정: 프로필 화면에서 직접 수정, 설정 → &ldquo;내 데이터 내보내기&rdquo;로 전체 데이터 JSON 다운로드</li>
          <li>동의 철회: 설정에서 이용 통계 수집을 언제든 끌 수 있습니다(끄는 즉시 수집 중단)</li>
          <li>삭제(탈퇴): 프로필 → 계정 관리 → 탈퇴 (2단계 확인 후 즉시 삭제)</li>
        </ul>
      </Section>

      <Section title="8. 개인정보의 파기">
        <ul className="space-y-1.5 text-xs text-warm-text list-disc pl-4">
          <li>탈퇴 시 데이터베이스에서 트랜잭션으로 일괄 삭제합니다.</li>
          <li>업로드 이미지는 저장소에서 삭제합니다.</li>
        </ul>
      </Section>

      <Section title="9. 개인정보 보호책임자">
        <div className="divide-y divide-warm-border/55">
          <Row label="책임자" value="운영자" />
          <Row label="연락처" value="zaballgam@gmail.com" />
        </div>
      </Section>

      <Section title="10. 고지 의무">
        <p className="text-xs text-warm-text mb-2">
          본 방침의 내용 추가·삭제·수정이 있을 경우 앱 내 공지를 통해 알립니다.
        </p>
        <p className="text-xs text-warm-sub">시행일: 2026년 7월 10일</p>
      </Section>
    </div>
  );
}
