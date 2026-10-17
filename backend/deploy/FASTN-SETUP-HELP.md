# QuizShield Fastn setup fields

## Current status — setup completed

The staging teacher completed Google consent using the existing managed provider. Both Calendar and Sheets connections are active and passed real live actions, teacher ownership checks and the full hosted lifecycle. Google staging sync is now enabled for the verified dedicated destinations. See [the verification report](STAGING-VERIFICATION.md).

**No new Client ID, Client Secret or API documentation is required for this completed setup.** The earlier New auth provider form came from connector provider discovery; explicitly selecting the managed provider resolved the consent path. Fastn feedback `01792264083-6cdfd466` records that UI issue. Do not return the user to that form.

The separate product discovery page is optional for this running automation. “Webhooks · none found” means discovery did not find public webhook documentation on the product site. It does not describe the authenticated staging triggers already created in Fastn. No API key should be pasted into a documentation-URL field.

## Manual OAuth provider reference — only if a separate Google app is needed

Client ID and Client Secret must come from an OAuth **Web application** created in the owner's Google Cloud project. They cannot be invented or replaced with a Fastn key, Resend key, Supabase key or QuizShield password. Enter a client secret directly in Fastn's secure provider form. The existing Fastn-managed provider's private secret is not available to copy.

| Form field | Value |
| --- | --- |
| Name | QuizShield Google Calendar |
| Description | Google Calendar authorization for teacher-owned QuizShield assessment schedules. |
| Client ID | The Google Cloud OAuth Web application Client ID; no value generated for QuizShield yet |
| Client Secret | The matching Google Cloud client secret; keep it in Fastn |
| Scope editor | Simple, space-separated scopes |
| Response Type | code |
| Authorization URL | https://accounts.google.com/o/oauth2/v2/auth |
| Token URL | https://oauth2.googleapis.com/token |
| Grant Type | Authorization code (with grant_type), authCodeGrantWithGrantType |
| Token Grant Type | Refresh token (with grant_type), refreshTokenWithGrantType |
| URL Variables | Leave empty |
| Name this account | QuizShield staging |

Calendar scopes, as one space-separated line:

```text
https://www.googleapis.com/auth/calendar.events.owned https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.calendars.readonly
```

When configuring a separate Google Cloud app, enable the Calendar API, configure the consent audience/test user and register the **exact redirect URI used by Fastn** on that Web application. Do not use the Vercel API root as a guessed callback. The actual redirect URI for this custom-provider path has not been verified. Offline access must be requested so the connection can refresh after the browser is closed.

Official references: [Google credential creation](https://developers.google.com/workspace/guides/create-credentials), [OAuth endpoints and refresh](https://developers.google.com/identity/protocols/oauth2/web-server), [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth), [Fastn managed OAuth](https://github.com/fastn-ai/docs/blob/main/tutorials/saas-admin/configuring-a-connector.md).

## Connect your product page

| Field | Value |
| --- | --- |
| Product name | QuizShield |
| Product domain | quiz-shield.vercel.app |
| What QuizShield does | QuizShield is an assessment platform where teachers manage courses, enrol students, schedule and publish quizzes, review submissions and release results. It provides controlled notifications and teacher-owned Calendar and Sheets integrations. |
| Entities | Users (teachers and students), Courses, Enrolments, Quizzes, Quiz Attempts/Submissions, Released Results, Automation Jobs |
| API access / API docs | Select **We don't have public docs** for now. No published OpenAPI/Swagger endpoint was found in the current implementation. The backend root URL is not an API documentation URL. |

Add the entities with **Type your own...**, then save Entities. Save the API access selection separately. Customers, Orders, Invoices, Tickets and Contacts are suggested examples, not QuizShield's data model.

Product discovery helps Fastn understand the product. It does not authorize Google or activate its workflows. The verified hosted email and Google flows already run independently of completing this form. Real automation tests continue on https://quizshield-automation-staging.vercel.app; the original production backend is not being replaced.
