import { readdirSync } from 'node:fs';
import js from '@eslint/js';
import importX from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import security from 'eslint-plugin-security';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// One zone per feature: a feature may import `shared/`, `api/`, `auth/` and
// `ws/`, never another feature. Computed from the folders so a new feature is
// covered without editing this file.
const features = (() => {
  try {
    return readdirSync('src/features', { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch {
    return [];
  }
})();
const featureZones = features.map(name => ({
  target: `./src/features/${name}`,
  from: './src/features',
  except: [`./${name}`],
  message: 'Features do not import each other; move shared code to src/shared.',
}));

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'src/api/schema.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  security.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, 'import-x': importX },
    settings: { 'import-x/resolver': { typescript: true } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      ...(featureZones.length
        ? { 'import-x/no-restricted-paths': ['error', { zones: featureZones }] }
        : {}),
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Device strings render as text only.',
        },
        {
          selector: "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]",
          message: 'Device strings render as text only.',
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: 'Device strings render as text only.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Use shared/ui/persisted-state (UI state only; never tokens).' },
      ],
    },
  },
  {
    files: ['src/shared/ui/persisted-state.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'src/test/**'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    files: ['*.config.ts', 'eslint.config.js', 'scripts/**'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Build-time tools reading the repository, never request data.
    files: ['*.config.ts', 'eslint.config.js', 'scripts/**'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'security/detect-non-literal-fs-filename': 'off' },
  },
);
