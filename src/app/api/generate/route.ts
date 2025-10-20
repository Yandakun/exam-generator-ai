// src/app/api/generate/route.ts

import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

// 💡 새로운 타입 정의: OpenAI 메시지 콘텐츠의 구조를 명확히 합니다.
type MessageContent = {
    type: "text";
    text: string;
} | {
    type: "image_url";
    image_url: { url: string };
};


// 1. 요청 본문 크기 제한 설정
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

// 2. OpenAI 클라이언트 초기화 및 키 확인
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인하고 서버를 재시작하세요.");
}

const openai = new OpenAI();

// 3. 문제 생성 API 라우트 핸들러 (POST 메서드)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const texts: string[] = body.texts; 

    if (!texts || texts.length === 0) {
      return NextResponse.json({ error: '텍스트 데이터가 누락되었습니다.' }, { status: 400 });
    }
    
    // 텍스트 데이터를 하나의 문자열로 합칩니다.
    const fullTextContent = texts.join('\n\n'); 

    // 프롬프트 구성 (MessageContent 타입 사용)
    const finalInstruction: MessageContent = {
        type: "text",
        // 🚨 수정: 4지선다, 정답 1개, 중복 방지 지침 반영
        text: `다음은 PDF에서 추출한 텍스트 전문입니다: \n\n${fullTextContent}\n\n위 텍스트를 분석하여 해당 내용에 기반한 총 10개의 시험 문제를 한국어로 생성해 주세요.
        
        ### 문제 유형 및 개수 요구 사항
        1. 객관식(4지선다) 문제: 8개 (각 문제는 정답이 반드시 1개여야 합니다.)
        2. 주관식(단답형) 문제: 2개
        
        ### 중복 방지 및 창의성 지침
        - 이전에 출제되지 않은 새로운 영역의 내용을 탐색하여 문제를 생성하십시오.
        - 객관식 보기 4개(A, B, C, D) 중 정답은 반드시 1개여야 하며, 명확해야 합니다.
        
        ### 출력 형식 (JSON)
        반드시 'questions' 키를 가진 최상위 JSON 객체 { "questions": [...] } 형태로만 반환해야 합니다.
        'questions' 배열은 다음 규칙을 따르는 10개의 객체를 포함해야 합니다:

        객관식(type: 'MULTIPLE_CHOICE'): options 필드에 A부터 D까지 4개의 보기를 포함해야 합니다.
        주관식(type: 'SHORT_ANSWER'): options 필드는 반드시 빈 배열 []이어야 합니다.

        예시 구조:
        {
          "questions": [
            { "type": "MULTIPLE_CHOICE", "question": "...", "options": ["...", "...", "...", "..."], "answer": "A", "explanation": "..." },
            { "type": "SHORT_ANSWER", "question": "...", "options": [], "answer": "단답형 정답", "explanation": "..." }
          ]
        }`,
    };
    
    const contents: MessageContent[] = [finalInstruction]; 

    // 4. OpenAI API 호출
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', 
      messages: [
        {
          role: 'user',
          content: contents,
        },
      ],
      response_format: { type: "json_object" }, 
      // 🚨 수정: 중복 방지 및 창의성을 위해 temperature를 0.5로 설정
      temperature: 0.5, 
      max_tokens: 8000,
    });

    // 5. AI 응답 처리 및 반환
    const rawResponseText = response.choices[0].message.content;
    
    // 토큰 사용량 정보를 추출 (클라이언트에서 사용하지 않으므로 제거 가능)
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };


    // 안전한 JSON 파싱 로직
    try {
        const resultJson = JSON.parse(rawResponseText || '{}');
        // 문제 결과와 토큰 사용량 정보를 함께 반환
        return NextResponse.json({ 
            result: resultJson,
            usage: usage, 
        }, { status: 200 });
    } catch (e) {
        // JSON 파싱에 실패한 경우
        console.error('JSON Parsing Failed: AI가 유효하지 않은 JSON을 반환했습니다.', e);
        console.error('Raw AI Response Text:', rawResponseText); 
        return NextResponse.json({ 
            error: 'AI가 유효하지 않은 JSON을 반환했습니다. 서버 콘솔을 확인해주세요.', 
        }, { status: 500 });
    }

  } catch (error) {
    console.error('OpenAI API 호출 중 서버 오류 발생:', error);
    // API 호출 자체에서 발생한 오류 (키 오류, 네트워크 오류 등)
    return NextResponse.json({ error: '시험 문제 생성 중 서버 오류가 발생했습니다.' }, { status: 500 });
  }
}