# Security assessment and NIST CSF mapping

22 September 2026. This is a code-and-test assessment, not a penetration-test certificate or a legal compliance opinion. The requested “NOST” is interpreted as [NIST Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework). Its functions organise ongoing risk management; a framework name does not establish security.

| Function | Implemented evidence | Remaining operating work |
|---|---|---|
| Govern | Owner documented; source/privacy/payment behaviour described; separate deployment secrets | Publish commercial legal identity/contact, provider contracts, risk owner and review cadence |
| Identify | Data stores and service map in DEPLOY; locked dependencies; provider catalog | Production asset inventory, data classification and measured capacity |
| Protect | Salted password hashes; hashed HttpOnly sessions; origin checks; account ownership; sharing roles; signed payment capture; transactional ledger; cloud throttles; proxy guard; escaped notebook HTML and no-network PDF rendering | MFA/recovery for local password accounts, secrets manager procedures, access review, deployed WAF verification |
| Detect | Health probe; failed-job state; bounded provider errors; reproducible tests | Central metrics/log redaction, alerts, anomaly detection and audit-event retention |
| Respond | Stop/retry generation without double charge; revoke share invitations; operator-reviewed payment disputes | Incident runbook, support rota, notification decision process, reward/refund abuse tooling |
| Recover | Durable reservations/leases; replay-safe payment processing; explicit migration snapshot | Scheduled backups, tested restores, recovery objectives and regional outage drills |

## Verified boundaries

- Private lessons reject unrelated accounts. Shared viewers cannot edit. Editors require an active invitation; revoked access is rejected.
- Note saves include the version captured when editing began; stale writes return a conflict.
- Generated HTML is escaped. Print rendering embeds trusted fonts and blocks external network requests.
- Payment processing validates captured status, currency, amount and owner. Capture, wallet grant and referral rewards commit together; duplicate events do not grant twice.
- Mongo tests run against an actual local replica set with competing reservations, lease claims and duplicate payment callbacks. They do not prove Atlas network policy or production capacity.
- Upload extraction checks declared formats/magic bytes and size/expansion limits. Uploaded source material is data, never an instruction authority.

## Material limits

Provider quota breakers are process-local; a large worker fleet needs coordinated provider budgets. Browser/device compatibility, real Google credentials, merchant checkout, deployed upload limits, production backups and cloud failover still require environment tests. Password recovery remains an operator-assisted workflow. Referral anti-abuse is basic eligibility and replay protection, not a fraud-scoring system. The curated book library is unpopulated; no rights to competitors’ libraries are assumed.

The service must not advertise “100% secure”, “NIST certified”, guaranteed accuracy or 100,000-user capacity based on these checks.
