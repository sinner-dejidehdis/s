// Privacy policy and terms of service for the test prototype. Before a real
// launch, add the operator, a contact address and governing law, and have
// the text reviewed by a lawyer.
(function (root) {
  const S = root.Sigao = root.Sigao || {};

  const UPDATED = '28 October 2026';

  const draft = `<p class="legal-draft">Arguo is a test prototype. Please do not upload confidential or unpublished work you cannot afford to lose.</p>`;

  const privacy = `<article class="legal wrap">
    <h1>Privacy Policy</h1>
    <p class="legal-date">Last updated ${UPDATED}</p>
    ${draft}
    <p>Arguo is an academic writing feedback tool run by the Arguo team (“we”, “us”). This policy explains what we collect, why, who processes it, and your rights. We wrote it to be short and plain.</p>

    <h2>The short version</h2>
    <ul>
      <li>Your manuscripts are yours. We never sell them, never use them to train AI models, and never publish them.</li>
      <li>Without an account, your project stays in your own browser.</li>
      <li>With an account, your projects are stored in our database so you can open them on any device. Only you can read them.</li>
      <li>When you ask for AI feedback, the text you ask about is sent to our AI provider to generate notes, and is not used for training.</li>
      <li>We do not use advertising or tracking cookies.</li>
    </ul>

    <h2>What we collect</h2>
    <ul>
      <li><b>Project content.</b> What you enter in Arguo: research questions, literature notes, results, discussion text, references, reviewer comments and checklist state. Without an account this stays in your browser’s local storage. If you save a project to your account, it is stored in our database.</li>
      <li><b>Account data.</b> Your email address and a securely hashed password, plus the dates you signed up and last signed in.</li>
      <li><b>Text sent for AI feedback.</b> Only when you press “Get AI feedback”, and only the content of that module.</li>
      <li><b>References you check.</b> When you use the citation check, the text of each reference is sent to Crossref to look up the record.</li>
      <li><b>Technical data.</b> Like any website, our hosting provider receives your IP address, browser type and request times. We use this only to run and protect the service.</li>
    </ul>

    <h2>Why we use it (legal bases)</h2>
    <ul>
      <li>To provide the service you ask for: storing projects, generating feedback, checking references (performance of a contract).</li>
      <li>To keep the service secure and working, for example preventing abuse of the free AI quota (legitimate interests).</li>
      <li>To send account emails such as sign-up confirmation and password reset (performance of a contract).</li>
    </ul>
    <p>We do not use your content for marketing, profiling or training AI models.</p>

    <h2>Who processes your data</h2>
    <p>We use these service providers. Each receives only what it needs.</p>
    <div class="table-wrap"><table class="legal-table">
      <thead><tr><th>Provider</th><th>What for</th><th>What it receives</th></tr></thead>
      <tbody>
        <tr><td>Cloudflare</td><td>Hosting the website and our AI relay server</td><td>Technical data; text sent for AI feedback passes through</td></tr>
        <tr><td>Supabase</td><td>Accounts and saved projects</td><td>Account data and saved projects</td></tr>
        <tr><td>Groq</td><td>Generating AI feedback</td><td>The text you ask about. Under Groq’s terms it is not used for training, is not retained by default, and logs may be kept up to 30 days for reliability and abuse prevention</td></tr>
        <tr><td>Crossref</td><td>Looking up references</td><td>The reference text you check</td></tr>
        <tr><td>Google Fonts, jsDelivr</td><td>Loading fonts and code libraries</td><td>Your IP address and browser details</td></tr>
      </tbody>
    </table></div>
    <p>Some providers may process data outside your country, including in the United States. Where the GDPR applies, transfers rely on safeguards such as the EU Standard Contractual Clauses or the EU–US Data Privacy Framework.</p>

    <h2>How long we keep it</h2>
    <ul>
      <li>Saved projects: until you delete them or your account.</li>
      <li>Account data: until you delete your account.</li>
      <li>Local projects: in your browser until you clear them or your browser data.</li>
      <li>Text sent for AI feedback: we do not store it; our AI provider’s retention is described above.</li>
    </ul>

    <h2>Your rights</h2>
    <p>Depending on where you live (for example under the GDPR, UK GDPR or California law), you can ask to access, correct, export or delete your data, object to or restrict processing, and withdraw consent. You can delete any saved project yourself from your account page. For anything else, including deleting your account, contact us through the site. You may also complain to your local data protection authority.</p>

    <h2>Security</h2>
    <p>Data is encrypted in transit. Passwords are hashed by our authentication provider and never visible to us. Database rules ensure each user can read only their own projects. No system is perfectly secure; if a breach affects you, we will tell you as the law requires.</p>

    <h2>Children</h2>
    <p>Arguo is not intended for anyone under 16. We do not knowingly collect data from children.</p>

    <h2>Changes</h2>
    <p>If we change this policy in a meaningful way, we will update the date above and tell account holders by email or in the app.</p>
  </article>`;

  const terms = `<article class="legal wrap">
    <h1>Terms of Service</h1>
    <p class="legal-date">Last updated ${UPDATED}</p>
    ${draft}
    <p>These terms are an agreement between you and the Arguo team (“we”, “us”) for your use of Arguo. By using Arguo or creating an account, you agree to them. Please also read our <a href="#privacy">Privacy Policy</a>.</p>

    <h2>1. What Arguo is</h2>
    <p>Arguo gives feedback on academic writing: it points out problems, explains how to fix them and shows examples from other topics. It does not write, rewrite or complete your manuscript. Arguo is currently a prototype and features may change or stop.</p>

    <h2>2. Your account</h2>
    <p>You must be at least 16 and give a valid email address. Keep your password secure; you are responsible for activity under your account. Tell us if you think your account has been misused.</p>

    <h2>3. Your content</h2>
    <p>You keep all rights to what you enter in Arguo. You give us only the permission needed to store, process and display it to provide the service, including sending it to the providers listed in the Privacy Policy. We do not claim ownership, publish your content or use it to train AI models. Do not enter content you have no right to use, or personal data about research participants unless you are permitted to share it with service providers like ours.</p>

    <h2>4. Academic integrity is your responsibility</h2>
    <ul>
      <li>Feedback from Arguo, including AI-generated notes, can be wrong or incomplete. Check it against your own judgement, your sources and your supervisor’s advice.</li>
      <li>You are responsible for your work and for following the rules of your institution, funders and journals, including any requirement to disclose the use of AI tools.</li>
      <li>The citation check compares references with Crossref records. A “verified” result means a matching record exists, not that the source supports your claim.</li>
    </ul>

    <h2>5. Acceptable use</h2>
    <p>Do not use Arguo to break the law or anyone’s rights; to try to make it generate text for you to submit as your own; to probe, overload or get around its limits or security; to access other users’ data; or to resell the service without our permission. We may limit or suspend use that breaks these terms or puts the service at risk.</p>

    <h2>6. Availability and changes</h2>
    <p>We provide Arguo “as is” and “as available”, without guarantees that it will be uninterrupted, error-free or keep any particular feature. Free AI feedback has daily limits. Keep your own copies of important work. We may change these terms; if a change matters, we will tell account holders before it takes effect.</p>

    <h2>7. Paid plans</h2>
    <p>Arguo is currently free. If we introduce paid plans, their prices and terms will be shown before you buy.</p>

    <h2>8. Liability</h2>
    <p>To the extent the law allows, we are not liable for indirect or consequential losses, lost data, rejected manuscripts or academic outcomes, and our total liability is limited to the amount you paid us in the 12 months before the claim (or 50 US dollars if you paid nothing). Nothing in these terms limits liability that cannot be limited by law, or your rights as a consumer where you live.</p>

    <h2>9. Ending your use</h2>
    <p>You can stop using Arguo at any time and ask us to delete your account. We may close accounts that break these terms, with notice where reasonable. Sections 3, 4 and 8 continue after your use ends.</p>
  </article>`;

  S.legal = { privacy: () => privacy, terms: () => terms };
})(typeof window !== 'undefined' ? window : globalThis);
