const Service = require('../Service.js');
const axios = require('axios');
const {encrypt, decrypt, maskApiKey} = require('../../utils/encryption');

/**
 * LLM Service - Direct HTTP calls to LLM APIs, bypassing the NLP broker.
 *
 * Handles API key management, provider routing, prompt template resolution,
 * and full I/O recording for all LLM interactions.
 *
 * @extends Service
 * @author CARE LLM Integration
 */
module.exports = class LLMService extends Service {
    constructor(server) {
        super(server, {
            cmdTypes: [
                'getProviders',
                'getModels',
                'getApiKeys',
                'addApiKey',
                'updateApiKey',
                'removeApiKey',
                'getPromptTemplates',
                'addPromptTemplate',
                'updatePromptTemplate',
                'removePromptTemplate',
                'getUsageStats',
                'getUsageLogs',
            ],
            resTypes: [
                'llmResult',
                'providerUpdate',
                'apiKeyUpdate',
                'promptTemplateUpdate',
                'usageStats',
                'usageLogs',
            ],
        });

        this.providers = [];
        this.requestTimeout = 120000;
    }

    async init() {
        const enabled = await this.server.db.models['setting'].get('service.llm.enabled');
        if (enabled === 'false') {
            this.logger.info('LLM Service is disabled. Change service.llm.enabled setting in the DB.');
            return;
        }

        const timeout = await this.server.db.models['setting'].get('service.llm.requestTimeout');
        if (timeout) this.requestTimeout = parseInt(timeout) || 120000;

        this.providers = await this.server.db.models['llm_provider'].getEnabled();
        this.logger.info(`LLM Service initialized with ${this.providers.length} providers`);
    }

    async connectClient(client, data) {
        await this.send(client, 'providerUpdate', this.providers);
        await super.connectClient(client, data);
    }

    /**
     * Handle incoming LLM requests from the frontend
     */
    async request(client, data) {
        const userId = client.userId;
        const startTime = Date.now();

        try {
            const {provider: providerSlug, model, messages, promptTemplateId, templateParams, context} = data;

            let resolvedMessages = messages;
            if (promptTemplateId && templateParams) {
                resolvedMessages = await this._resolvePromptTemplate(promptTemplateId, templateParams);
            }

            if (!resolvedMessages || !resolvedMessages.length) {
                throw new Error('No messages provided for LLM request');
            }

            const apiKey = await this._resolveApiKey(userId, providerSlug);
            if (!apiKey) {
                throw new Error(`No API key available for provider "${providerSlug}". Please add one in the API Keys dashboard.`);
            }

            const provider = this.providers.find(p => p.slug === providerSlug);
            if (!provider || !provider.enabled) {
                throw new Error(`Provider "${providerSlug}" is not available or has been disabled by an administrator.`);
            }

            const maxTokens = parseInt(await this.server.db.models['setting'].get('service.llm.maxTokensPerRequest')) || 4096;
            const decryptedKey = decrypt(apiKey.encryptedKey);
            const endpoint = apiKey.apiEndpoint || provider.apiBaseUrl;

            const result = await this._callProvider(providerSlug, endpoint, decryptedKey, model, resolvedMessages, maxTokens);

            const latencyMs = Date.now() - startTime;

            const logEntry = await this.server.db.models['llm_log'].create({
                userId,
                apiKeyId: apiKey.id,
                provider: providerSlug,
                model,
                documentId: context?.documentId || null,
                studySessionId: context?.studySessionId || null,
                studyStepId: context?.studyStepId || null,
                input: {messages: resolvedMessages},
                output: result.content,
                inputTokens: result.usage?.inputTokens || null,
                outputTokens: result.usage?.outputTokens || null,
                estimatedCost: result.usage?.estimatedCost || null,
                latencyMs,
                status: 'success',
            });

            await this.server.db.models['api_key'].updateById(apiKey.id, {lastUsedAt: new Date()});

            await this.send(client, 'llmResult', {
                id: data.id,
                data: result.content,
                usage: result.usage,
                logId: logEntry.id,
            });

        } catch (err) {
            const latencyMs = Date.now() - startTime;
            this.logger.error('LLM request failed: ' + err.message);

            try {
                await this.server.db.models['llm_log'].create({
                    userId,
                    provider: data.provider || 'unknown',
                    model: data.model || 'unknown',
                    documentId: data.context?.documentId || null,
                    studySessionId: data.context?.studySessionId || null,
                    studyStepId: data.context?.studyStepId || null,
                    input: {messages: data.messages},
                    output: {error: err.message},
                    latencyMs,
                    status: 'error',
                });
            } catch (logErr) {
                this.logger.error('Failed to log error: ' + logErr.message);
            }

            await this.send(client, 'llmResult', {
                id: data.id,
                error: err.message,
            });
        }
    }

    /**
     * Handle commands (CRUD operations, stats queries)
     */
    async command(client, command, data) {
        const userId = client.userId;

        switch (command) {
            case 'getProviders': {
                await this.send(client, 'providerUpdate', this.providers);
                break;
            }

            case 'getModels': {
                const providerSlug = data?.provider;
                if (providerSlug) {
                    const provider = this.providers.find(p => p.slug === providerSlug);
                    await this.send(client, 'providerUpdate', provider ? [provider] : []);
                } else {
                    await this.send(client, 'providerUpdate', this.providers);
                }
                break;
            }

            case 'getApiKeys': {
                const keys = await this.server.db.models['api_key'].getAccessibleKeys(userId);
                const safeKeys = keys.map(k => ({
                    ...k,
                    encryptedKey: undefined,
                    maskedKey: maskApiKey(decrypt(k.encryptedKey)),
                }));
                await this.send(client, 'apiKeyUpdate', safeKeys);
                break;
            }

            case 'addApiKey': {
                const encryptedKey = encrypt(data.apiKey);
                const newKey = await this.server.db.models['api_key'].add({
                    userId,
                    provider: data.provider,
                    name: data.name,
                    apiEndpoint: data.apiEndpoint || null,
                    encryptedKey,
                    enabled: true,
                    shared: data.shared || false,
                    sharedScope: data.sharedScope || 'none',
                    sharedTargetId: data.sharedTargetId || null,
                    usageLimitMonthly: data.usageLimitMonthly || null,
                });
                const safeKey = {
                    ...newKey,
                    encryptedKey: undefined,
                    maskedKey: maskApiKey(data.apiKey),
                };
                await this.send(client, 'apiKeyUpdate', [safeKey]);
                break;
            }

            case 'updateApiKey': {
                const existing = await this.server.db.models['api_key'].getById(data.id);
                if (!existing || (existing.userId !== userId && !(await client.isAdmin?.()))) {
                    throw new Error('API key not found or access denied');
                }
                const updateData = {
                    name: data.name,
                    enabled: data.enabled,
                    shared: data.shared,
                    sharedScope: data.sharedScope,
                    sharedTargetId: data.sharedTargetId,
                    usageLimitMonthly: data.usageLimitMonthly,
                };
                if (data.apiKey) {
                    updateData.encryptedKey = encrypt(data.apiKey);
                }
                if (data.apiEndpoint !== undefined) {
                    updateData.apiEndpoint = data.apiEndpoint;
                }
                await this.server.db.models['api_key'].updateById(data.id, updateData);

                const keys = await this.server.db.models['api_key'].getAccessibleKeys(userId);
                const safeKeys = keys.map(k => ({
                    ...k,
                    encryptedKey: undefined,
                    maskedKey: maskApiKey(decrypt(k.encryptedKey)),
                }));
                await this.send(client, 'apiKeyUpdate', safeKeys);
                break;
            }

            case 'removeApiKey': {
                const keyToRemove = await this.server.db.models['api_key'].getById(data.id);
                if (!keyToRemove || (keyToRemove.userId !== userId && !(await client.isAdmin?.()))) {
                    throw new Error('API key not found or access denied');
                }
                await this.server.db.models['api_key'].deleteById(data.id);
                const keys = await this.server.db.models['api_key'].getAccessibleKeys(userId);
                const safeKeys = keys.map(k => ({
                    ...k,
                    encryptedKey: undefined,
                    maskedKey: maskApiKey(decrypt(k.encryptedKey)),
                }));
                await this.send(client, 'apiKeyUpdate', safeKeys);
                break;
            }

            case 'getPromptTemplates': {
                const templates = await this.server.db.models['prompt_template'].getAccessible(userId);
                await this.send(client, 'promptTemplateUpdate', templates);
                break;
            }

            case 'addPromptTemplate': {
                const newTemplate = await this.server.db.models['prompt_template'].add({
                    userId,
                    name: data.name,
                    description: data.description || null,
                    provider: data.provider || null,
                    model: data.model || null,
                    promptText: data.promptText,
                    inputMapping: data.inputMapping || {},
                    defaultOutputMapping: data.defaultOutputMapping || {},
                    shared: data.shared || false,
                    sharedScope: data.sharedScope || 'none',
                    sharedTargetId: data.sharedTargetId || null,
                });
                await this.send(client, 'promptTemplateUpdate', [newTemplate]);
                break;
            }

            case 'updatePromptTemplate': {
                const tmpl = await this.server.db.models['prompt_template'].getById(data.id);
                if (!tmpl || (tmpl.userId !== userId && !(await client.isAdmin?.()))) {
                    throw new Error('Template not found or access denied');
                }
                await this.server.db.models['prompt_template'].updateById(data.id, {
                    name: data.name,
                    description: data.description,
                    provider: data.provider,
                    model: data.model,
                    promptText: data.promptText,
                    inputMapping: data.inputMapping,
                    defaultOutputMapping: data.defaultOutputMapping,
                    shared: data.shared,
                    sharedScope: data.sharedScope,
                    sharedTargetId: data.sharedTargetId,
                });
                const templates = await this.server.db.models['prompt_template'].getAccessible(userId);
                await this.send(client, 'promptTemplateUpdate', templates);
                break;
            }

            case 'removePromptTemplate': {
                const tmplToRemove = await this.server.db.models['prompt_template'].getById(data.id);
                if (!tmplToRemove || (tmplToRemove.userId !== userId && !(await client.isAdmin?.()))) {
                    throw new Error('Template not found or access denied');
                }
                await this.server.db.models['prompt_template'].deleteById(data.id);
                const templates = await this.server.db.models['prompt_template'].getAccessible(userId);
                await this.send(client, 'promptTemplateUpdate', templates);
                break;
            }

            case 'getUsageStats': {
                const isAdmin = await client.isAdmin?.();
                const stats = await this.server.db.models['llm_log'].getUsageStats(
                    isAdmin && data?.systemWide ? null : userId,
                    data?.days || 30
                );
                await this.send(client, 'usageStats', stats);
                break;
            }

            case 'getUsageLogs': {
                const isAdmin = await client.isAdmin?.();
                const filter = data.filter || {};
                if (!isAdmin) {
                    filter.userId = userId;
                }
                const logs = await this.server.db.models['llm_log'].getLogs({
                    limit: data.limit || 25,
                    page: data.page || 0,
                    filter,
                    order: data.order || [['createdAt', 'DESC']],
                });
                await this.send(client, 'usageLogs', logs);
                break;
            }

            default:
                await super.command(client, command, data);
        }
    }

    /**
     * Resolve the best API key for a user and provider
     */
    async _resolveApiKey(userId, providerSlug) {
        const userKey = await this.server.db.models['api_key'].resolveKey(userId, providerSlug);
        if (userKey) return userKey;

        const fallbackProvider = await this.server.db.models['setting'].get('service.llm.systemApiKeyProvider');
        const fallbackKey = await this.server.db.models['setting'].get('service.llm.systemApiKey');
        if (fallbackProvider === providerSlug && fallbackKey) {
            return {
                id: null,
                provider: providerSlug,
                encryptedKey: fallbackKey,
                apiEndpoint: null,
            };
        }

        return null;
    }

    /**
     * Resolve a prompt template by substituting {{param}} placeholders
     */
    async _resolvePromptTemplate(templateId, params) {
        const template = await this.server.db.models['prompt_template'].getById(templateId);
        if (!template) throw new Error('Prompt template not found');

        let resolved = template.promptText;
        for (const [key, value] of Object.entries(params)) {
            const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            resolved = resolved.replace(placeholder, typeof value === 'string' ? value : JSON.stringify(value));
        }

        return [{role: 'user', content: resolved}];
    }

    /**
     * Route to the correct provider API and normalize the response
     */
    async _callProvider(providerSlug, endpoint, apiKey, model, messages, maxTokens) {
        switch (providerSlug) {
            case 'openai':
                return await this._callOpenAI(endpoint, apiKey, model, messages, maxTokens);
            case 'anthropic':
                return await this._callAnthropic(endpoint, apiKey, model, messages, maxTokens);
            case 'google':
                return await this._callGoogle(endpoint, apiKey, model, messages, maxTokens);
            default:
                return await this._callOpenAI(endpoint, apiKey, model, messages, maxTokens);
        }
    }

    async _callOpenAI(endpoint, apiKey, model, messages, maxTokens) {
        const response = await axios.post(
            `${endpoint}/chat/completions`,
            {model, messages, max_tokens: maxTokens},
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: this.requestTimeout,
            }
        );

        const data = response.data;
        return {
            content: data.choices?.[0]?.message?.content || '',
            usage: {
                inputTokens: data.usage?.prompt_tokens || 0,
                outputTokens: data.usage?.completion_tokens || 0,
                estimatedCost: this._estimateCost('openai', model, data.usage?.prompt_tokens, data.usage?.completion_tokens),
            },
        };
    }

    async _callAnthropic(endpoint, apiKey, model, messages, maxTokens) {
        const systemMsg = messages.find(m => m.role === 'system');
        const nonSystemMsgs = messages.filter(m => m.role !== 'system');

        const body = {
            model,
            max_tokens: maxTokens,
            messages: nonSystemMsgs,
        };
        if (systemMsg) body.system = systemMsg.content;

        const response = await axios.post(
            `${endpoint}/messages`,
            body,
            {
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json',
                },
                timeout: this.requestTimeout,
            }
        );

        const data = response.data;
        const textContent = data.content?.find(c => c.type === 'text')?.text || '';
        return {
            content: textContent,
            usage: {
                inputTokens: data.usage?.input_tokens || 0,
                outputTokens: data.usage?.output_tokens || 0,
                estimatedCost: this._estimateCost('anthropic', model, data.usage?.input_tokens, data.usage?.output_tokens),
            },
        };
    }

    async _callGoogle(endpoint, apiKey, model, messages, maxTokens) {
        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{text: m.content}],
            }));

        const systemInstruction = messages.find(m => m.role === 'system');
        const body = {
            contents,
            generationConfig: {maxOutputTokens: maxTokens},
        };
        if (systemInstruction) {
            body.systemInstruction = {parts: [{text: systemInstruction.content}]};
        }

        const response = await axios.post(
            `${endpoint}/models/${model}:generateContent?key=${apiKey}`,
            body,
            {
                headers: {'Content-Type': 'application/json'},
                timeout: this.requestTimeout,
            }
        );

        const data = response.data;
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return {
            content: textContent,
            usage: {
                inputTokens: data.usageMetadata?.promptTokenCount || 0,
                outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
                estimatedCost: this._estimateCost('google', model,
                    data.usageMetadata?.promptTokenCount, data.usageMetadata?.candidatesTokenCount),
            },
        };
    }

    /**
     * Rough cost estimation per provider/model (USD per 1M tokens)
     */
    _estimateCost(provider, model, inputTokens, outputTokens) {
        const rates = {
            'openai': {input: 2.50, output: 10.00},
            'anthropic': {input: 3.00, output: 15.00},
            'google': {input: 0.15, output: 0.60},
        };

        const rate = rates[provider] || {input: 1.0, output: 3.0};
        const inCost = ((inputTokens || 0) / 1_000_000) * rate.input;
        const outCost = ((outputTokens || 0) / 1_000_000) * rate.output;
        return Math.round((inCost + outCost) * 1_000_000) / 1_000_000;
    }
};
