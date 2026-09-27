# Unit & PBT Test Execution Instructions - Iteration 2 (Units 1, 2 & 3)

## Execution Commands

### Run All Unit Tests
```powershell
cd packages/server
$env:NODE_ENV="test"

# Unit 3 Tests
npx ts-node -T tests/unit/git-supervisor.test.ts

# Unit 2 Tests
npx ts-node -T tests/unit/adaptive-backoff.test.ts

# Unit 1 Tests
npx ts-node -T tests/unit/prompt-registry.test.ts
npx ts-node -T tests/unit/sliding-window.test.ts
npx ts-node -T tests/unit/structured-output.test.ts
npx ts-node -T tests/unit/heartbeat-lease-manager.test.ts
```

### Run All Property-Based Tests (PBT Baseline)
```powershell
cd packages/server
$env:NODE_ENV="test"

# Unit 1 PBT Invariants (PBT-U1-01 a PBT-U1-04)
npx ts-node -T tests/pbt/unit-1-invariants.test.ts

# Unit 2 PBT Invariants (PBT-U2-01 a PBT-U2-04)
npx ts-node -T tests/pbt/unit-2-invariants.test.ts

# Unit 3 PBT Invariants (PBT-U3-01 a PBT-U3-04)
npx ts-node -T tests/pbt/unit-3-invariants.test.ts
```

## Expected Results
- **Git Supervisor Suite (Unit 3)**: 6/6 passing
- **Adaptive Backoff & Auto-Recovery Suite (Unit 2)**: 5/5 passing
- **Prompt Registry Suite (Unit 1)**: 4/4 passing
- **Sliding Window Suite (Unit 1)**: 3/3 passing
- **Structured Output Suite (Unit 1)**: 3/3 passing
- **Heartbeat Lease Manager Suite (Unit 1)**: 4/4 passing
- **Unit 1 PBT Invariants**: 4/4 passing (350 randomized iterations)
- **Unit 2 PBT Invariants**: 4/4 passing (350 randomized iterations)
- **Unit 3 PBT Invariants**: 4/4 passing (350 randomized iterations)
- **Total Passing**: 37/37 tests (0 failures, 100% pass rate)
