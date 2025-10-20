// src/utils/pdfProcessor.ts

/**
 * PDF 파일을 읽어 각 페이지에서 텍스트를 추출하는 함수
 */
export async function extractTextFromPdf(file: File): Promise<string[]> {
    if (typeof window === 'undefined') {
        throw new Error("이 함수는 브라우저 환경에서만 실행될 수 없습니다.");
    }
    
    // DOMMatrix 오류 회피 핵심: pdfjs-dist를 함수 실행 시점(클라이언트)에 동적으로 import
    const pdfjsModule = await import('pdfjs-dist');
    
    // 🚨 오류 해결 핵심: @ts-expect-error 주석을 제거하고, any를 허용하는 ESLint 주석만 남깁니다.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any
    const pdfjs: any = pdfjsModule; 
    
    // Worker 파일 경로 설정
    pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    
    // 🚨 오류 해결 핵심 2: 두 번째 @ts-expect-error 주석을 제거합니다.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any
    const pdfDocument = await (pdfjs.getDocument({ data: arrayBuffer })).promise; 
    const numPages = pdfDocument.numPages;
    const pageTexts: string[] = [];
    
    // 페이지 제한 없이 전체 페이지를 처리
    const pagesToProcess = numPages; 

    for (let i = 1; i <= pagesToProcess; i++) {
        const page = await pdfDocument.getPage(i);
        
        const textContent = await page.getTextContent();
        
        // item 오류 및 any 오류 회피
        const pageText = textContent.items
            // item 타입을 구조적으로 명확히 함
            .map((item: { str: string } | object) => { 
                if (typeof item === 'object' && item !== null && 'str' in item && typeof (item as { str: string }).str === 'string') {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return (item as { str: string }).str;
                }
                return ''; 
            })
            .join('\n');
        
        pageTexts.push(`--- Page ${i} START ---\n${pageText}\n--- Page ${i} END ---`);
        page.cleanup();
    }

    return pageTexts;
}