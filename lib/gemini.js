async function generateDailyLogWithLLM(rawActivity) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di environment!');
  }

  const prompt = `Kamu adalah asisten pembuat laporan harian peserta magang di Badan Pusat Statistik (BPS) Kabupaten Ketapang.
Berdasarkan input kegiatan singkat berikut:
"${rawActivity}"

Tuliskan laporan harian dalam bahasa Indonesia formal-natural dengan ketentuan mutlak:
1. "activity_log": Uraian aktivitas yang dilakukan secara jelas dan profesional (WAJIB antara 150 hingga 300 karakter).
2. "lesson_learned": Pemahaman teknis atau manfaat yang dipelajari dari kegiatan tersebut (WAJIB antara 150 hingga 300 karakter).
3. "obstacles": Kendala teknis ringan yang wajar dihadapi saat mengerjakan tugas tersebut beserta solusinya (WAJIB antara 150 hingga 300 karakter).`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            activity_log: { type: 'STRING' },
            lesson_learned: { type: 'STRING' },
            obstacles: { type: 'STRING' }
          },
          required: ['activity_log', 'lesson_learned', 'obstacles']
        }
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Gemini API Error (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  rawText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

  let parsed = JSON.parse(rawText);
  if (Array.isArray(parsed)) parsed = parsed[0];

  for (const key of ['activity_log', 'lesson_learned', 'obstacles']) {
    if (!parsed[key] || parsed[key].trim().length < 105) {
      throw new Error(`Hasil generate "${key}" terlalu pendek (${parsed[key]?.length || 0} karakter, minimal sistem 100 karakter). Coba kirim ulang.`);
    }
  }
  return parsed;
}

module.exports = { generateDailyLogWithLLM };
