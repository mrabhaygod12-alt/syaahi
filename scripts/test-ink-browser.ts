import assert from "node:assert/strict";
import {mkdtempSync, mkdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawn} from "node:child_process";
import {chromium} from "playwright";
import {fixturePdf} from "./fixtures/pdf";
const origin = "http://localhost:3217";
Object.assign(process.env, {DATA_DIR:mkdtempSync(join(tmpdir(),"syaahi-ink-browser-")),DATA_BACKEND:"sqlite",MONGODB_URI:"",APP_ROLE:"all",WORKER_MODE:"external",BACKEND_URL:"",NEXT_DIST_DIR:".next-validation",NEXT_PUBLIC_APP_URL:origin,TAVILY_API_KEY:"",BRAVE_SEARCH_API_KEY:""});
async function main() {
  const auth = await import("../lib/auth/server");
  const {markEmailVerified} = await import("../lib/billing/rewards");
  const {saveOrder} = await import("../lib/billing/orders");
  const {db} = await import("../lib/db");
  const user=await auth.register("Ink student","ink-browser@example.test","fixture-password-long");
  await markEmailVerified(user.id); await saveOrder("ink-browser-paid",user.id,"try",900,3);
  db().prepare("UPDATE orders SET paid=1,payment_id='pay_browser_fixture' WHERE id='ink-browser-paid'").run();
  const cookie=(await auth.startSession(user,new Request(origin))).headers.get("set-cookie")!.split(";")[0].split("=")[1];
  const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--port","3217"],{env:process.env,windowsHide:true,stdio:"ignore"});
  const browser=await chromium.launch({headless:true});
  try {
    for(let i=0;i<150;i++){try{if((await fetch(origin+"/api/health")).ok)break;}catch{} await new Promise(r=>setTimeout(r,200));}
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.addCookies([{name:"syaahi-session",value:cookie,url:origin}]);
    const page=await context.newPage(); const errors:string[]=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.goto(origin+"/ink"); await page.getByLabel("Title",{exact:true}).waitFor();
    if (await page.getByRole("button",{name:"Essential only",exact:true}).isVisible()) await page.getByRole("button",{name:"Essential only",exact:true}).click();
    const text="Machine learning models require substantial amounts of labelled training data to generalise well. When the training set is small or biased the resulting model tends to reproduce those biases at inference time. Researchers have therefore explored semi supervised approaches that combine a small labelled set with a much larger unlabelled corpus.";
    await page.getByLabel("Title",{exact:true}).fill("Research chapter — integrity review");
    await page.getByLabel("Your text",{exact:true}).fill(text);
    await page.getByLabel("Reference text to compare (optional)").fill(text);
    mkdirSync("output/ink-browser",{recursive:true});
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:"output/ink-browser/desktop-composer.png",fullPage:true});
    await page.getByRole("button",{name:"Check this draft",exact:true}).click();
    await page.waitForURL(/\/ink\/report\//); await page.getByRole("heading",{name:"Research chapter — integrity review",exact:true}).waitFor();
    assert((await page.locator("mark[data-kind=plag]").count())>0);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:"output/ink-browser/desktop-report.png",fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"mobile report overflows");
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:"output/ink-browser/mobile-report.png",fullPage:true});
    const id=page.url().split("/").pop();
    await page.goto(origin+`/ink/rewrite?report=${id}`);
    await page.getByLabel("Passage",{exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelector<HTMLTextAreaElement>("#ink-rewrite-text")?.value.length!>100);
    assert.equal(await page.getByLabel("Passage",{exact:true}).inputValue(),text);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"mobile rewrite overflows");
    // Explicit local UI fixture: prove provider errors stay visible, never mistaken for a result.
    await page.route("**/api/ink/rewrite",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Fixture provider unavailable"})}));
    await page.getByRole("button",{name:/Rewrite passage|Rewrite this|Rewrite section|Rewrite$/}).first().click();
    await page.getByRole("alert").filter({hasText:"Fixture provider unavailable"}).waitFor();
    await page.goto(origin+"/ink"); await page.getByLabel("Title",{exact:true}).waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"mobile composer overflows");
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:"output/ink-browser/mobile-composer.png",fullPage:true});
    const imported=await page.request.post(origin+"/api/ink/import",{headers:{origin},multipart:{file:{name:"chapter.pdf",mimeType:"application/pdf",buffer:fixturePdf(text+" This chapter explains database normalization in detail.")}}});
    assert.equal(imported.status(),200,await imported.text()); assert.match((await imported.json()).text,/normalization/);
    await page.goto(origin+`/ink/report/${id}`); await page.getByRole("button",{name:"Delete private report"}).waitFor();
    await page.getByRole("button",{name:"Delete private report"}).click(); await page.getByRole("button",{name:"Confirm permanent deletion"}).click();
    await page.waitForURL(/\/ink\/reports$/);
    await context.clearCookies(); await page.goto(origin+"/ink"); await page.getByRole("link",{name:"Sign in",exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    console.log("PASS built AI Ink desktop/mobile: authenticated paid gate, real source report/highlights, report-to-rewrite load, HTTP error UI, PDF import, deletion and anonymous sign-in gate. No live AI/search calls.");
  } finally {await browser.close();server.kill();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
