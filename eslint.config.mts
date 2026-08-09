import { Linter } from "eslint";
import typescriptParser from "@typescript-eslint/parser";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// eslint.config.mts가 위치한 프로젝트 루트의 절대 경로를 구한다.
// parserOptions.project는 파일 위치 기준 상대 경로 해석으로 인해 각 워크스페이스 하위에서
// tsconfig.base.json을 찾지 못하는 문제가 있으므로, 루트 경로를 고정 참조한다.
const projectRootDir = dirname(fileURLToPath(import.meta.url));

// 모노레포 전체 워크스페이스에 통합 적용할 Flat Config 정의 선언
const config: Linter.Config[] = [
  {
    // 정적 스타일 규칙 검사 대상에서 제외할 빌드 부산물 디렉토리 목록 명시
    ignores: ["**/dist/**", "**/node_modules/**", "**/public/**"],
  },
  {
    // 분석 대상 소스코드 포맷 범위 지정 (TypeScript 전체 범위 적용)
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        // 루트의 타입 분석 명세를 연계 상속하여 분석 신뢰도 유지
        project: resolve(projectRootDir, "./tsconfig.base.json"),
      },
    },
    plugins: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "@typescript-eslint": typescriptPlugin as any,
    },
    rules: {
      // any 변수 선언 시 에러를 유발하여 unknown 전환 유도
      "@typescript-eslint/no-explicit-any": "error",
      // 컴파일 에러를 사전에 차단하기 위해 사용되지 않는 변수 감지 시 경고 활성화
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      // 일관된 정적 코드 가독성 제고를 위해 세미콜론 사용 필수화
      semi: ["error", "always"],
    },
  },
];

export default config;
