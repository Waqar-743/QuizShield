// Google-only relay. QuizShield supplies the current, verified teacher binding.
// Literal connector calls let Fastn enforce the MULTI_TENANT manifest.
function validateGoogleInput(base,input,headers) {
  if (input?.channel !== 'fastn' || !['calendar','sheets'].includes(input.kind)) throw new Error('Google-only workflow');
  if (!input.tenantId || !input.installationId || headers?.['x-end-org-id'] !== input.tenantId || headers?.['x-installation-id'] !== input.installationId) {
    throw new Error('Teacher connection context is missing or mismatched');
  }
  if (typeof input.executionToken !== 'string' || !input.executionToken) throw new Error('Missing delivery token');
  if (typeof base !== 'string' || !/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]+)?\/api\/automations\/delivery$/.test(base)) throw new Error('Invalid QuizShield callback base');
  let jobId;
  for (const [key,suffix] of [['preflightUrl','preflight'],['completeUrl','complete']]) {
    const value=input[key],prefix=base+'/';
    if (typeof value !== 'string' || !value.startsWith(prefix)) throw new Error('Invalid callback URL');
    const match=/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/(preflight|complete)$/.exec(value.slice(prefix.length));
    if (!match || match[2] !== suffix || (jobId && jobId !== match[1])) throw new Error('Invalid callback URL');
    jobId=match[1];
  }
}

async function runGoogleDelivery(input,runtime) {
  const preflight=async()=>{
    const current=await runtime.request(input.preflightUrl,{});
    if (current.skipped || current.alreadyCompleted) return null;
    if (current.channel !== 'fastn' || current.kind !== input.kind || current.payload?.tenantId !== input.tenantId || current.payload?.installationId !== input.installationId) {
      throw new Error('Verified teacher binding changed');
    }
    return current.payload;
  };
  const payload=await preflight();
  if (!payload) return {skipped:true};
  let providerId;
  if (input.kind === 'calendar') {
    await runtime.ownCalendar(payload.calendarId);
    const existing=await runtime.calendar('get',payload);
    if (![200,404,410].includes(existing.status)) throw new Error('Calendar lookup failed');
    const latest=await preflight();if(!latest)return {skipped:true};
    if (latest.revision !== payload.revision || latest.calendarId !== payload.calendarId || latest.eventId !== payload.eventId) throw new Error('Schedule revision changed');
    if (latest.operation === 'cancel') {
      if (existing.status === 200 && existing.body?.status !== 'cancelled') {
        const removed=await runtime.calendar('cancel',latest);
        if (![200,204,404,410].includes(removed.status)) throw new Error('Calendar cancellation failed');
      }
      providerId=latest.eventId;
    } else {
      const resource={id:latest.eventId,summary:latest.summary,description:latest.description,start:latest.start,end:latest.end,
        extendedProperties:{private:{quizshieldRevision:String(latest.revision)}},reminders:{useDefault:false},attendees:[]};
      let result=await runtime.calendar(existing.status === 200 ? 'update':'insert',{...latest,resource});
      if(result.status === 409)result=await runtime.calendar('update',{...latest,resource});
      if(![200,201].includes(result.status) || result.body?.id !== latest.eventId || result.body?.status === 'cancelled') throw new Error('Calendar provider receipt missing');
      providerId=result.body.id;
    }
  } else {
    await runtime.sheetExists(payload.spreadsheetId);
    const latest=await preflight();if(!latest)return {skipped:true};
    if(latest.spreadsheetId !== payload.spreadsheetId || latest.range !== payload.range)throw new Error('Results destination changed');
    const result=await runtime.sheets(latest);
    if(result.status !== 200 || !result.body?.updatedRange || result.body.updatedRows !== 1 || result.body.updatedCells !== 6)throw new Error('Sheets provider receipt missing');
    providerId=latest.spreadsheetId+':'+result.body.updatedRange;
  }
  await runtime.request(input.completeUrl,{success:true,providerId});
  return {success:true,providerId};
}

async function connectedRuntime(ctx,base) {
  validateGoogleInput(base,ctx.input,ctx.headers);
  const fastn=new Fastn({connectors:{quizshieldGoogleCalendar:{orgId:'custom'},googleSheets:{orgId:'managed'}}});
  const normalize=async(call,expectedErrors=[])=>{
    try {const result=await call();if(result.success === false)throw new Error('Connector did not confirm success');return {status:result.status,body:result.output};}
    catch(error){if(expectedErrors.includes(error.statusCode))return {status:error.statusCode,body:{}};throw error;}
  };
  const runtime={
    request:async(url,body)=>{
      const response=await fetch(url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','x-quizshield-execution-token':ctx.input.executionToken},body:JSON.stringify(body)});
      if(!response.ok)throw new Error('QuizShield callback HTTP '+response.status);
      return response.json();
    },
    ownCalendar:async(calendarId)=>{
      let pageToken;
      for(let page=0;page<20;page++){
        const result=await fastn.connector.quizshieldGoogleCalendar.listOwnedCalendars({maxResults:250,...(pageToken?{pageToken}:{})});
        const match=result.output?.items?.find(row=>row.id === calendarId && row.accessRole === 'owner');
        if(match){if(match.notificationSettings?.notifications?.length)throw new Error('Use a dedicated calendar without email subscriptions');return;}
        pageToken=result.output?.nextPageToken;if(!pageToken)break;
      }
      throw new Error('Calendar is not owned by this teacher');
    },
    calendar:(operation,p)=>{
      const args={calendarId:p.calendarId,eventId:p.eventId};
      if(operation === 'get')return normalize(()=>fastn.connector.quizshieldGoogleCalendar.getAssessmentEvent(args),[404,410]);
      if(operation === 'cancel')return normalize(()=>fastn.connector.quizshieldGoogleCalendar.cancelAssessmentEvent(args),[404,410]);
      if(operation === 'insert')return normalize(()=>fastn.connector.quizshieldGoogleCalendar.createAssessmentEvent({calendarId:p.calendarId,resource:p.resource}),[409]);
      if(operation === 'update')return normalize(()=>fastn.connector.quizshieldGoogleCalendar.updateAssessmentEvent({...args,resource:p.resource}));
      throw new Error('Unknown Calendar operation');
    },
    sheetExists:async(spreadsheetId)=>{
      const result=await fastn.connector.googleSheets.getSpreadsheet({spreadsheetId,fields:'spreadsheetId'});
      if(result.output?.spreadsheetId !== spreadsheetId)throw new Error('Sheets destination is unavailable');
    },
    sheets:p=>normalize(()=>fastn.connector.googleSheets.updateValues({spreadsheetId:p.spreadsheetId,range:p.range,values:p.values,valueInputOption:'RAW'})),
  };
  return runGoogleDelivery(ctx.input,runtime);
}

export default async function quizshieldGoogle(ctx) {
  const base=await fastn.envConfig.get('QUIZSHIELD_API_BASE');
  return connectedRuntime(ctx,base);
}
