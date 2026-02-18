export default function ContactPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 pb-16 pt-10 md:px-8">
      <h1 className="text-3xl font-black tracking-tight">문의하기</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-700">
        <p>서비스 관련 문의, 오류 제보, 제휴 요청은 아래 이메일로 연락해 주세요.</p>
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-semibold">contact@brickify.ai</p>
        <p>광고, 정책, 결제, 콘텐츠 관련 문의 시 화면 캡처와 재현 경로를 함께 전달해 주시면 대응이 빨라집니다.</p>
      </div>
    </main>
  );
}
