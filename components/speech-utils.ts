// token will be expired in 30 days!!
const TOKEN = ''

function createUrl(url: string, params: Record<string, string>) {
  const result = new URL(url)
  Object.keys(params).forEach(key => result.searchParams.append(key, params[key]))
  return result.href
}


// export async function performASR(audioBlob: Blob): Promise<string> {
//   const url = 'https://vop.baidu.com/server_api'
//   const token = TOKEN
  
//   const formData = new FormData()
//   formData.append('audio', audioBlob, 'audio.wav')
//   formData.append('format', 'wav')
//   formData.append('rate', '16000')
//   formData.append('channel', '1')
//   formData.append('token', token)
//   formData.append('cuid', 'rehab-chat-room')
//   formData.append('dev_pid', '1537') // 普通话(纯中文识别)

//   const response = await fetch(url, {
//     method: 'POST',
//     body: formData
//   })

//   const result = await response.json()
//   if (result.err_no === 0) {
//     return result.result[0]
//   } else {
//     throw new Error(`ASR Error: ${result.err_msg}`)
//   }
// }

export async function performTTS(text: string): Promise<string> {
  const url = 'https://tsn.baidu.com/text2audio'
  const token = TOKEN
  
  const params = {
    tex: encodeURIComponent(text),
    tok: token,
    cuid: 'rehab-chat-room',
    ctp: '1',
    lan: 'zh',
    spd: '5',
    pit: '5',
    vol: '5',
    per: '0',
    mode: 'no-cors'
  }

  const fullUrl = createUrl(url, params)
  const response = await fetch(fullUrl)
  
  if (response.ok) {
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } else {
    const error = await response.json()
    throw new Error(`TTS Error: ${error.err_msg}`)
  }
}