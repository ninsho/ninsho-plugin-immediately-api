export const EM = {
  2200: null,
  2201: 'No role permissions.',
  2202: 'Unauthorized status.',
  2203: 'Unchanged email',
  2204: null,
  2205: 'Passwords do not match.',
  2206: null,
  2207: null,
  2208: null,
  2209: null,
  2210: 'fail send notice',

  2211: null,
  2212: null,
  2213: 'fail send notice',

  2214: null,
  2215: null,
  2216: null,
  2217: 'fail send notice',

  2218: null, 
  2219: 'No role permissions.',
  2220: 'Unauthorized status.',
  2221: null,
  2222: 'Passwords do not match.',
  2223: null,
  2224: null,
  2225: null,
  2226: null,
  2227: 'fail send notice',

  2228: 'Not enough arguments provided.',
  2229: 'Bad setting at requiredLoginItems.',
  2230: null,
  2231: 'No role permissions.',
  2232: 'Unauthorized status.',
  2233: null,
  2234: 'Passwords do not match.',
  2235: null,
  2236: null,
  2237: null,
  2238: 'fail send notice',

  // 2239: null,
  // 2240: 'Unauthorized status.',
  // 2241: null,
  // 2242: null,

  2243: null,
  2244: 'No role permissions.',
  2245: 'Unauthorized status.',
  2246: null,
  2247: 'Passwords do not match.',
  2248: null,
  2249: null,
  2250: null,
  2251: null,
  2252: 'fail send notice',

  2253: null,

  2299: null,
} as const
type EM = typeof EM & { [key:number]: string | null }

// Regular expression for searching the target line
// new E\d+|pushReplyCode\(
