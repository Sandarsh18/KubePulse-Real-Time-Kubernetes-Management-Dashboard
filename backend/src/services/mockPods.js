const STATUS_OPTIONS = ['Running', 'Pending', 'Failed', 'Succeeded'];

const makeContainer = (suffix) => ({
    name: `${suffix}-app`,
    image: 'ghcr.io/kubepulse/mock-observer:latest',
    ready: false,
    resources: {
        limits: { cpu: '50m', memory: '128Mi' },
        requests: { cpu: '25m', memory: '64Mi' }
    }
});

const mockPods = [
    {
        name: 'telemetry-scan-pending',
        namespace: 'kubepulse',
        status: 'Pending',
        ip: null,
        node: null,
        startTime: null,
        containers: [makeContainer('telemetry-scan')],
        isMock: true
    },
    {
        name: 'report-cron-failed',
        namespace: 'kubepulse',
        status: 'Failed',
        ip: '10.42.1.45',
        node: 'kind-worker',
        startTime: new Date(Date.now() - 3600 * 1000).toISOString(),
        containers: [makeContainer('report-cron')],
        isMock: true
    },
    {
        name: 'cache-primer-succeeded',
        namespace: 'kubepulse',
        status: 'Succeeded',
        ip: '10.42.2.21',
        node: 'kind-worker2',
        startTime: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        containers: [makeContainer('cache-primer')],
        isMock: true
    }
];

const getMockPods = (namespace) => mockPods.filter(pod => pod.namespace === namespace);

const updateMockPodStatus = (podName, status) => {
    if (!STATUS_OPTIONS.includes(status)) return null;
    const pod = mockPods.find(p => p.name === podName);
    if (!pod) return null;

    pod.status = status;
    if (status === 'Running') {
        pod.startTime = new Date().toISOString();
        pod.ip = pod.ip || `10.42.${Math.floor(Math.random() * 50) + 10}.${Math.floor(Math.random() * 100)}`;
        pod.node = pod.node || 'kind-worker';
    }
    pod.containers = pod.containers.map(container => ({
        ...container,
        ready: status === 'Running'
    }));
    return pod;
};

module.exports = {
    getMockPods,
    updateMockPodStatus,
    STATUS_OPTIONS
};
