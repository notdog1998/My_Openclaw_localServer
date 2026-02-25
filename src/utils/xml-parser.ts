export function parseXml(xml: string): Record<string, string> {
  const result: Record<string, string> = {};

  // CDATA 内容可能包含换行，使用 [\s\S]*? 匹配任意字符包括换行
  const cdataRegex = /<(\w+)><!\[CDATA\[([\s\S]*?)\]\]><\/\w+>/g;
  let match: RegExpExecArray | null;

  while ((match = cdataRegex.exec(xml)) !== null) {
    (result as Record<string, string>)[match[1]] = match[2];
  }

  const plainRegex = /<(\w+)>([^<]+)<\/\w+>/g;
  while ((match = plainRegex.exec(xml)) !== null) {
    const key = match[1];
    if (!(key in result)) {
      (result as Record<string, string>)[key] = match[2];
    }
  }

  return result;
}

export function buildReplyXml(toUser: string, fromUser: string, content: string): string {
  const time = Math.floor(Date.now() / 1000);
  return `<xml>
<ToUserName><![CDATA[${toUser}]]></ToUserName>
<FromUserName><![CDATA[${fromUser}]]></FromUserName>
<CreateTime>${time}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${content}]]></Content>
</xml>`;
}

export function buildEncryptedReplyXml(
  encrypted: string,
  signature: string,
  timestamp: string,
  nonce: string
): string {
  return `<xml>
<Encrypt><![CDATA[${encrypted}]]></Encrypt>
<MsgSignature><![CDATA[${signature}]]></MsgSignature>
<TimeStamp>${timestamp}</TimeStamp>
<Nonce><![CDATA[${nonce}]]></Nonce>
</xml>`;
}
