const fs = require('fs');
let html = fs.readFileSync('media-tracker.html', 'utf8');

const oldFetch = "fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AQ.Ab8RN6LKL2l3G6Yz4GBMKdrEX9Rv4wfdTKtvC4vGkIqI2QNCIQ',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})})";

const newFetch = "fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer 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','HTTP-Referer':'https://d21se3p58mjg34.cloudfront.net'},body:JSON.stringify({model:'meta-llama/llama-3.1-8b-instruct:free',messages:[{role:'user',content:prompt}]})})";

const oldParse = "const text=data.candidates[0].content.parts[0].text;";
const newParse = "const text=data.choices[0].message.content;";

html = html.split(oldFetch).join(newFetch);
html = html.split(oldParse).join(newParse);

fs.writeFileSync('media-tracker.html', html);
console.log('Done - replaced', html.split(newFetch).length - 1, 'API calls');
