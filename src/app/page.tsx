// ❌ 여기서 pdfProcessor를 직접 import 하지 않습니다.
// import { processPdfForImages } from '@/utils/pdfProcessor';

// ✨ 방금 만든 클라이언트 컴포넌트를 import 합니다.
import PdfUploadForm from '@/components/PdfUploadForm';

export default function Home() {
  return (
    <main>
      <h1>AI 시험 문제 생성기</h1>
      <p>PDF 파일을 업로드하여 시험 문제를 만들어보세요.</p>
      
      {/* 클라이언트 측 로직은 이 컴포넌트 안에 모두 격리됩니다. */}
      <PdfUploadForm />

    </main>
  );
}