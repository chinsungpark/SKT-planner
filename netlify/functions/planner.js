// Netlify Function — 구독 플래너 데이터 저장/불러오기 (Netlify Blobs)

// Netlify Blobs — siteID와 token을 환경변수에서 읽어서 명시적으로 설정
async function getBlobStore() {
  const { getStore } = await import('@netlify/blobs');
  const siteID = process.env.NETLIFY_SITE_ID;
  const token  = process.env.NETLIFY_TOKEN;
  if (!siteID || !token) throw new Error('NETLIFY_SITE_ID 또는 NETLIFY_TOKEN 환경변수가 없습니다.');
  return getStore({ name: 'skt-planner-data', siteID, token });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, data: saveData } = body;
    const store = await getBlobStore();

    // ── 데이터 저장 ────────────────────────────
    if (action === 'save') {
      if (!saveData) return { statusCode: 400, headers,
        body: JSON.stringify({ success: false, message: '저장할 데이터 없음' }) };
      await store.setJSON('main', saveData);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: '서버에 저장됨' }) };
    }

    // ── 데이터 불러오기 ──────────────────────────
    if (action === 'load') {
      const saved = await store.get('main', { type: 'json' });
      if (!saved) return { statusCode: 200, headers,
        body: JSON.stringify({ success: true, data: null, message: '저장된 데이터 없음' }) };
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: saved }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: '알 수 없는 요청' }) };

  } catch (e) {
    console.error('[planner function 오류]', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: e.message }) };
  }
};
