# Security Specification and Threat Model (TDD)

## 1. Data Invariants
- **Domain Restriction**: Only authenticated users with emails ending in `@bu.ac.th` can read or write any collection in the system.
- **Roster Access Control**: The admin roster is securely stored under `admin_settings/config` as `adminEmails`.
- **Admin Authorizations**: Creating, updating, or deleting any document in `documents` or mutating system counters requires valid verification.
- **Counter Invariance**: Suffix or prefix counters can only be incremented safely through authorized administrative transactions and must contain integer values.

## 2. The "Dirty Dozen" Threat Payloads (Verification Cases)

### Threat Category: Identity Spoofing & Privilege Escalation
1. **Payload #1: Outside Domain Read**
   - Attempt to list any collection with a generic Gmail account (`attacker@gmail.com`).
   - *Expected Action*: `PERMISSION_DENIED`.

2. **Payload #2: Unauthenticated Write**
   - Attempt to add a document to `/documents` without any Auth token.
   - *Expected Action*: `PERMISSION_DENIED`.

3. **Payload #3: Viewer Write Exploit**
   - Attempt to add a new record to `/documents` using a authenticated `@bu.ac.th` user who is NOT present in the verified `adminEmails` list.
   - *Expected Action*: `PERMISSION_DENIED`.

### Threat Category: Integrity & Structure Bypass
4. **Payload #4: Spoofed Registry Email**
   - Attempt to create an admin entry with `email_verified = false` to hijack identity rules.
   - *Expected Action*: `PERMISSION_DENIED`.

5. **Payload #5: Resource Poisoning ID Size Limit**
   - Attempt to write a document with an ID larger than 128 characters or containing complex attack scripts.
   - *Expected Action*: `PERMISSION_DENIED`.

6. **Payload #6: Over-sized Key Values**
   - Attempt to write fields containing massive strings (e.g., 2MB of notes data) to crash the storage capacity.
   - *Expected Action*: `PERMISSION_DENIED`.

7. **Payload #7: Multi-type Injection**
   - Attempt to change an integer key (`academicYear` or `counter`) to a boolean or text string.
   - *Expected Action*: `PERMISSION_DENIED`.

### Threat Category: State Shortcutting & Unauthorized Mutation
8. **Payload #8: Viewer Config Mutation**
   - Attempt to edit the `/admin_settings/config` file to add the viewer's own email to the list.
   - *Expected Action*: `PERMISSION_DENIED`.

9. **Payload #9: Unauthorized State Manipulation**
   - Attempt to delete historical counters or system config logs by a viewer.
   - *Expected Action*: `PERMISSION_DENIED`.

10. **Payload #10: Counter Decaying**
    - Attempt to update a sequence counter with a lower value or negative integer.
    - *Expected Action*: `PERMISSION_DENIED`.

11. **Payload #11: Mutated Temporal Timestamps**
    - Attempt to backdate `updatedAt` with custom older timestamps to bypass retention audits.
    - *Expected Action*: `PERMISSION_DENIED`.

12. **Payload #12: Metadata Hijacking**
    - Attempt to overwrite immutable structural properties of a processed record.
    - *Expected Action*: `PERMISSION_DENIED`.

---

## 3. Threat Model Verification Runner Framework (`firestore.rules.test.ts`)

```typescript
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "academic-inbox-repository-system",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "localhost",
      port: 8080
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Zero-Trust Academic Document Repository Security Rules", () => {
  test("Payload #1: Disallow access to unauthorized public domain users", async () => {
    const unauthenticatedDb = testEnv.authenticatedContext("viewer", {
      email: "attacker@gmail.com",
      email_verified: true
    }).firestore();
    
    await assertFails(unauthenticatedDb.collection("documents").get());
  });

  test("Payload #3: Disallow non-admin BU users from drafting new files", async () => {
    const studentDb = testEnv.authenticatedContext("student", {
      email: "student@bu.ac.th",
      email_verified: true
    }).firestore();

    await assertFails(studentDb.collection("documents").add({
      title: "Malicious Document Draft",
      number: "วพ. 999",
      category: "inbox"
    }));
  });
});
```
