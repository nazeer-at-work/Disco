const url = "https://dvnqcjprtviucdkirblo.supabase.co/rest/v1/analytics_events";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2bnFjanBydHZpdWNka2lyYmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTM0MjgsImV4cCI6MjA4ODQyOTQyOH0.ekFGldDNnbBaBqe6u6tgMiLwdzRo5Ag6zZRlTjWQ1l0";

fetch(url, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    event_name: 'test_event',
    device_id: 'test_device',
    pack: 'disco',
    properties: {}
  })
})
.then(r => r.json())
.then(data => console.log(JSON.stringify(data, null, 2)))
.catch(console.error);
