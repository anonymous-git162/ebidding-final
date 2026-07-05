const mockApiInstance = vi.hoisted(() => {
  const fn = vi.fn((config: any) => mockApiInstance.request(config)) as any;
  fn.get = vi.fn();
  fn.post = vi.fn();
  fn.request = vi.fn();
  fn.defaults = { baseURL: '/api' };
  fn.interceptors = { response: { use: vi.fn() }, request: { use: vi.fn() } };
  return fn;
});

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockApiInstance),
    post: (...args: any[]) => mockApiInstance.post(...args),
    defaults: { headers: { common: {} } },
  },
}));

import api from '../services/api';

const responseErrorHandler = mockApiInstance.interceptors.response.use.mock.calls[0][1];

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('location', { pathname: '/other', href: '' });
  });

  it('should have correct defaults', () => {
    expect(api.defaults.baseURL).toBe('/api');
  });

  it('should make GET requests', async () => {
    mockApiInstance.get.mockResolvedValue({ data: 'ok' });
    const result = await api.get('/test');
    expect(result.data).toBe('ok');
  });

  it('should make POST requests', async () => {
    mockApiInstance.post.mockResolvedValue({ data: { id: 1 } });
    const result = await api.post('/test', { foo: 'bar' });
    expect(result.data.id).toBe(1);
  });

  it('should handle 401 with successful token refresh', async () => {
    const err = { response: { status: 401 }, config: { url: '/test', _retry: false } };
    mockApiInstance.post.mockResolvedValue({});
    mockApiInstance.request.mockResolvedValue({ data: 'retried' });
    const result = await responseErrorHandler(err);
    expect(result).toEqual({ data: 'retried' });
    expect(mockApiInstance.request).toHaveBeenCalledWith(expect.objectContaining({ url: '/test' }));
  });

  it('should redirect to /login on refresh failure', async () => {
    const err = { response: { status: 401 }, config: { url: '/test', _retry: false } };
    mockApiInstance.post.mockRejectedValue(new Error('refresh failed'));
    await expect(responseErrorHandler(err)).rejects.toThrow();
    expect(window.location.href).toBe('/login');
  });

  it('should pass through non-401 errors', async () => {
    const err = { response: { status: 500 }, config: { url: '/test' } };
    await expect(responseErrorHandler(err)).rejects.toBe(err);
  });
});
