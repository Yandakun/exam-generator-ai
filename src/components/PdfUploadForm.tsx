// src/components/PdfUploadForm.tsx

"use client";
import { useState } from 'react';
import { extractTextFromPdf } from '@/utils/pdfProcessor'; 

// 문제 타입 정의
interface GeneratedQuestion {
  type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

// 최종 객체 구조 타입 정의
interface GeneratedQuestionsResult {
    questions: GeneratedQuestion[]; 
}

// 풀이 결과 타입 정의
interface UserAnswers {
    [index: number]: string; 
}

export default function PdfUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<string[] | null>(null); 
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestionsResult | null>(null); 
  
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [isGraded, setIsGraded] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const resetQuizState = () => {
    setUserAnswers({});
    setIsGraded(false);
    setCorrectCount(0);
    setIsProcessing(false); 
  };
  
  const resetAllState = () => {
    setFile(null);
    setGeneratedQuestions(null);
    setExtractedData(null);
    resetQuizState();
    setIsProcessing(false); 
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("파일 선택 이벤트 발생:", e.target.files);
    
    resetAllState(); 
    
    if (e.target.files && e.target.files[0].type === 'application/pdf') {
      setFile(e.target.files[0]);
      console.log("✅ PDF 파일 인식 성공:", e.target.files[0].name);
    } else {
      setFile(null); 
      alert('PDF 파일만 선택해 주세요.');
      console.log("❌ 파일 인식 실패 또는 타입 불일치");
    }
  };
  
  const handleRedoQuiz = () => {
      if (generatedQuestions) {
          resetQuizState();
          alert('같은 문제로 다시 시작합니다.');
      }
  };

  const handleNewQuiz = async () => {
      if (file && extractedData) {
          resetQuizState();
          setIsProcessing(true);
          setGeneratedQuestions(null);
          
          try {
              const apiResponse = await fetch('/api/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ texts: extractedData }),
              });

              if (!apiResponse.ok) {
                  const errorData = await apiResponse.json();
                  throw new Error(errorData.error || '새 문제 생성 API 호출 실패');
              }

              const data = await apiResponse.json();
              setGeneratedQuestions(data.result as GeneratedQuestionsResult); 
              alert(`🎉 새로운 문제 ${data.result.questions.length}개가 생성되었습니다.`);

          } catch (error) {
              console.error('새 문제 생성 중 오류 발생:', error);
              alert('새 문제 생성 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
          } finally {
              setIsProcessing(false);
          }
      } else {
          alert('먼저 PDF를 업로드하고 문제를 생성해야 합니다.');
      }
  };


  const handleAnswerChange = (index: number, answer: string) => {
      if (isGraded) return;
      setUserAnswers(prev => ({
          ...prev,
          [index]: answer
      }));
  };
  
  const handleGrade = () => {
      if (!generatedQuestions) return;
      
      let count = 0;
      generatedQuestions.questions.forEach((q, index) => {
          const userAnswer = userAnswers[index] || '';
          
          const normalizedUserAnswer = userAnswer.trim().toUpperCase();
          const normalizedCorrectAnswer = q.answer.trim().toUpperCase();
          
          if (normalizedUserAnswer === normalizedCorrectAnswer) {
              count++;
          }
      });
      
      setCorrectCount(count);
      setIsGraded(true);
      
      alert(`채점 완료! 총 ${generatedQuestions.questions.length} 문제 중 ${count}개를 맞혔습니다.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 50)); 
    
    resetQuizState(); 
    setExtractedData(null); 

    try {
      const pageTexts = await extractTextFromPdf(file);
      setExtractedData(pageTexts); 

      console.log(`총 ${pageTexts.length} 페이지의 텍스트 데이터 추출 준비 완료.`);

      const apiResponse = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ texts: pageTexts }), 
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(errorData.error || '문제 생성 API 호출 실패');
      }

      const data = await apiResponse.json();
      setGeneratedQuestions(data.result as GeneratedQuestionsResult); 
      
      const problemCount = data.result.questions.length;

      alert(`🎉 시험 문제 생성 성공! 총 ${problemCount} 문제가 준비되었습니다. (10문제 요청, GPT-4o 사용)`);

    } catch (error) {
      console.error('전체 처리 과정 중 오류 발생:', error);
      alert('오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    } finally {
      setIsProcessing(false); 
    }
  };

  const getOptionStyle = (q: GeneratedQuestion, index: number, option: string) => {
      if (!isGraded) return {};
      
      const userAnswer = userAnswers[index];
      const isCorrect = userAnswer === q.answer;
      const isSelected = userAnswer === option;
      const isAnswer = q.answer === option;

      if (isAnswer && isGraded) {
          return { border: '2px solid green', fontWeight: 'bold', backgroundColor: '#e6ffe6' };
      }
      if (isSelected && !isCorrect) {
          return { backgroundColor: '#ffe6e6', fontWeight: 'bold' };
      }
      return {};
  };

  // 렌더링
  return (
    <form onSubmit={handleSubmit}>
      
      {/* 1. 초기 파일 선택 화면 (종료하기 상태) */}
      {!generatedQuestions && (
        <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
          <input type="file" accept="application/pdf" onChange={handleFileChange} />
          <button 
            type="submit" 
            // 파일이 없거나(null) 처리 중일 때만 비활성화
            disabled={!file || isProcessing} 
            style={{ marginLeft: '10px', padding: '8px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            {isProcessing ? '문제 생성 중...(GPT-4o)' : '시험 문제 생성'}
          </button>
        </div>
      )}
      
      {/* 💡 문제 생성 중 로딩 메시지 (시각적 피드백 개선) */}
      {isProcessing && !generatedQuestions && (
        <div style={{ 
            padding: '15px', 
            backgroundColor: '#fffbe6', 
            border: '1px solid #ffe500', 
            marginBottom: '20px', 
            fontWeight: 'bold', 
            color: '#cc9900',
            display: 'flex', 
            alignItems: 'center'
        }}>
            <span style={{ marginRight: '10px', fontSize: '1.2em' }}>⚙️</span> 
            ⏳ PDF 텍스트 추출 및 AI 문제 생성 중입니다. 잠시만 기다려 주세요. (GPT-4o 작업 중...)
        </div>
      )}


      {/* 2. 문제 풀이/결과 화면 */}
      {generatedQuestions && ( 
        <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '15px' }}>
            <h2>✅ 생성된 시험 문제 ({generatedQuestions.questions.length}개)</h2>
            
            {/* 새로운 버튼 그룹 (UX) - 상단 */}
            <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #eee' }}>
                {isGraded && (
                    <button 
                        type="button" 
                        onClick={handleRedoQuiz}
                        style={{ marginRight: '10px', padding: '8px 15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        다시 풀기 (같은 문제)
                    </button>
                )}
                <button 
                    type="button" 
                    onClick={handleNewQuiz}
                    disabled={isProcessing}
                    style={{ marginRight: '10px', padding: '8px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    {isProcessing ? '새 문제 생성 중...' : '새로운 문제 풀기'}
                </button>
                <button 
                    type="button" 
                    onClick={resetAllState}
                    style={{ padding: '8px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    종료하기 (첫 화면)
                </button>
            </div>
            
            {/* 채점 결과 표시 */}
            {isGraded && (
                <div style={{ padding: '10px', backgroundColor: '#f0f8ff', border: '1px solid #cce5ff', marginBottom: '20px' }}>
                    <strong>✨ 채점 결과:</strong> 총 {generatedQuestions.questions.length} 문제 중 **{correctCount}개** 정답!
                </div>
            )}
            
            {/* 3. 문제 목록 영역 */}
            {generatedQuestions.questions.map((q, index) => {
                const userAnswerNormalized = (userAnswers[index] || '').trim().toUpperCase();
                const isCorrect = isGraded && (userAnswerNormalized === q.answer.trim().toUpperCase());
                const isWrong = isGraded && (userAnswerNormalized !== q.answer.trim().toUpperCase());
                
                return (
                    <div key={index} style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', backgroundColor: isCorrect ? '#e6ffe6' : isWrong ? '#ffe6e6' : 'white' }}>
                        
                        <p style={{ float: 'right', color: '#888', fontSize: '0.8em' }}>[{q.type === 'MULTIPLE_CHOICE' ? '객관식' : '주관식'}]</p>
                        
                        <p><strong>{index + 1}. {q.question}</strong></p>
                        
                        {/* 객관식 풀이 영역 */}
                        {q.type === 'MULTIPLE_CHOICE' && (
                            <div style={{ margin: '10px 0' }}>
                                {q.options.map((opt, i) => {
                                    const optionKey = String.fromCharCode(65 + i); // A, B, C...
                                    const isSelected = userAnswers[index] === optionKey;
                                    return (
                                        <div 
                                            key={i} 
                                            style={{ 
                                                padding: '5px 10px', 
                                                border: '1px solid #ccc', 
                                                borderRadius: '4px', 
                                                marginBottom: '5px',
                                                cursor: isGraded ? 'default' : 'pointer',
                                                backgroundColor: isSelected ? '#e0f7fa' : 'white',
                                                ...getOptionStyle(q, index, optionKey)
                                            }}
                                            onClick={() => handleAnswerChange(index, optionKey)}
                                        >
                                            <strong>{optionKey}.</strong> {opt}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        
                        {/* 주관식 풀이 영역 */}
                        {q.type === 'SHORT_ANSWER' && (
                            <input 
                                type="text" 
                                value={userAnswers[index] || ''} 
                                onChange={(e) => handleAnswerChange(index, e.target.value)}
                                disabled={isGraded}
                                placeholder="단답형 정답을 입력하세요"
                                style={{ 
                                    width: '100%', 
                                    padding: '8px', 
                                    marginTop: '10px', 
                                    border: isGraded ? (isCorrect ? '1px solid green' : '1px solid red') : '1px solid #007bff' 
                                }}
                            />
                        )}
                        
                        {/* 채점 결과 및 해설 */}
                        {isGraded && !isCorrect && (
                            <div style={{ marginTop: '15px', padding: '10px', border: '1px solid red', backgroundColor: '#ffe0e0' }}>
                                <p style={{ color: 'red', fontWeight: 'bold' }}>오답입니다. 사용자의 답: {userAnswers[index] || '미입력'}</p>
                                <p style={{ color: 'darkgreen', fontWeight: 'bold' }}>정답: {q.answer}</p>
                                <p style={{ fontSize: '0.9em', color: '#333' }}>해설: {q.explanation}</p>
                            </div>
                        )}
                        
                        {isGraded && isCorrect && (
                             <div style={{ marginTop: '15px', padding: '10px', border: '1px solid green', backgroundColor: '#e6ffe6' }}>
                                <p style={{ color: 'darkgreen', fontWeight: 'bold' }}>정답입니다!</p>
                                <p style={{ fontSize: '0.9em', color: '#333' }}>해설: {q.explanation}</p>
                            </div>
                        )}

                    </div>
                );
            })}
            
            {/* 💡 채점하기 버튼 - 문제 목록 영역의 가장 마지막에 배치 */}
            {!isGraded && (
                <div style={{ marginTop: '30px', paddingTop: '15px', borderTop: '1px solid #eee', textAlign: 'center' }}>
                    <button 
                        type="button" 
                        onClick={handleGrade}
                        style={{ padding: '12px 30px', backgroundColor: '#ffc107', color: 'black', fontWeight: 'bold', border: 'none', borderRadius: '5px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                    >
                        채점하기
                    </button>
                </div>
            )}
        </div>
      )}
    </form>
  );
}