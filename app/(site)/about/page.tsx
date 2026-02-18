export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 pb-16 pt-10 md:px-8">
      <h1 className="text-3xl font-black tracking-tight">서비스 소개</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-700">
        <p>
          Brickify AI는 사용자가 업로드한 사진을 기반으로 브릭 스타일 결과물과 부품 리스트를 생성해 조립 경험을 돕는
          디지털 서비스입니다.
        </p>
        <p>
          저희는 과도한 광고 배치보다 유용한 콘텐츠와 명확한 사용자 경험을 우선합니다. 메인 화면, 생성 화면, 다운로드
          화면 모두 서비스 목적에 맞는 정보와 기능 중심으로 제공됩니다.
        </p>
        <p>
          자동 생성 결과물은 참고용이며, 실제 조립 시 부품 호환성, 강도, 구조 안정성을 사용자가 최종 검토해야 합니다.
        </p>
      </div>
    </main>
  );
}
