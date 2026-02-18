export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 pb-16 pt-10 md:px-8">
      <h1 className="text-3xl font-black tracking-tight">개인정보처리방침</h1>
      <p className="mt-4 text-xs text-zinc-500">시행일: 2026-02-18</p>

      <div className="mt-6 space-y-8 text-sm leading-relaxed text-zinc-700">
        <section className="space-y-3">
          <h2 className="text-lg font-black text-zinc-900">1. 개인정보의 처리 목적 및 수집 항목</h2>
          <p>
            Brickify AI(이하 &quot;서비스&quot;)는 사진 기반 브릭 도안 생성, 다운로드 제공, 문의 응대, 서비스 품질 개선을 위해 필요한 최소
            범위의 정보를 처리합니다.
          </p>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="font-bold text-zinc-900">수집 항목(예시)</p>
            <p className="mt-2">
              업로드 이미지 파일, 생성 결과 식별값(jobId), 서비스 이용기록(접속 로그, 오류 로그, 요청 시간), 결제 처리에 필요한 최소
              정보, 문의 시 제공한 이메일 및 문의 내용
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black text-zinc-900">2. 개인정보의 보유 및 이용기간</h2>
          <p>서비스는 수집 목적 달성 시 지체 없이 파기하는 것을 원칙으로 합니다.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>생성/다운로드 처리 데이터: 처리 완료 후 일정 기간 보관 후 파기</li>
            <li>문의 내역: 문의 처리 완료 후 분쟁 대응 목적의 기간 동안 보관 후 파기</li>
            <li>관계 법령에 따라 보존이 필요한 정보: 법정 보존기간 준수 후 파기</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black text-zinc-900">3. 개인정보의 제3자 제공</h2>
          <p>
            서비스는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만, 이용자의 사전 동의가 있거나 법령에 근거가 있는
            경우에 한해 제공합니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black text-zinc-900">4. 개인정보 처리위탁</h2>
          <p>서비스 제공을 위해 아래와 같이 외부 서비스에 업무 일부를 위탁할 수 있습니다.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>클라우드/호스팅 및 배포 인프라</li>
            <li>이미지/AI 처리 연동 서비스</li>
            <li>파일 저장소 및 로그/모니터링 서비스</li>
            <li>결제 서비스(연동 시)</li>
          </ul>
          <p>위탁 범위와 수탁사는 변경될 수 있으며, 변경 시 본 방침을 통해 고지합니다.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black text-zinc-900">5. 쿠키 및 광고 식별자 사용</h2>
          <p>
            서비스는 이용 편의 및 광고 운영을 위해 쿠키 또는 유사 기술을 사용할 수 있습니다. Google AdSense 등 광고 서비스 사용 시
            관련 식별자가 활용될 수 있습니다.
          </p>
          <p>이용자는 브라우저 설정을 통해 쿠키 저장을 거부하거나 삭제할 수 있습니다.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black text-zinc-900">6. 이용자의 권리 및 행사 방법</h2>
          <p>이용자는 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지 요청을 할 수 있습니다.</p>
          <p>
            요청은 문의 이메일로 접수할 수 있으며, 본인 확인 절차 후 관계 법령 및 내부 기준에 따라 지체 없이 처리합니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black text-zinc-900">7. 개인정보의 파기 절차 및 방법</h2>
          <p>
            보유기간 경과 또는 처리 목적 달성 시 복구가 불가능한 방식으로 안전하게 파기합니다. 전자적 파일은 기술적 방법으로 삭제하고,
            출력물은 분쇄 또는 소각합니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black text-zinc-900">8. 개인정보 보호를 위한 조치</h2>
          <p>
            서비스는 접근권한 관리, 전송구간 보호, 로그 모니터링 등 합리적인 보안 조치를 적용하여 개인정보 보호를 위해 노력합니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black text-zinc-900">9. 문의처</h2>
          <p>개인정보 관련 문의 및 민원은 아래 이메일로 접수해 주세요.</p>
          <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-semibold">hiom123@naver.com</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black text-zinc-900">10. 방침 변경</h2>
          <p>본 방침은 법령, 서비스 정책 또는 기능 변경에 따라 수정될 수 있으며, 변경 시 본 페이지를 통해 고지합니다.</p>
        </section>
      </div>
    </main>
  );
}
