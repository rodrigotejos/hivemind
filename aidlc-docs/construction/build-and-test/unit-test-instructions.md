# Unit & PBT Test Execution Instructions

## Execution Commands

### Run All Unit Tests
```bash
cd packages/server
npx ts-node -T tests/unit/prompt-registry.test.ts
npx ts-node -T tests/unit/sliding-window.test.ts
npx ts-node -T tests/unit/structured-output.test.ts
npx ts-node -T tests/unit/heartbeat-lease-manager.test.ts
```

### Run Property-Based Tests (PBT Baseline)
```bash
cd packages/server
npx ts-node -T tests/pbt/unit-1-invariants.test.ts
```

## Expected Results
- **Prompt Registry Suite**: 4/4 passing
- **Sliding Window Suite**: 3/3 passing
- **Structured Output Suite**: 3/3 passing
- **Heartbeat Lease Manager Suite**: 4/4 passing
- **PBT Invariants Suite**: 4/4 passing (100 runs each)
- **Total Passing**: 18/18 tests (0 failures)
