import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TorRequest {
  requestType: 'RFI' | 'RFP' | 'RFQ';
  category: string;
  title: string;
  description: string;
}

interface VendorScoreRequest {
  vendorName: string;
  price: number;
  proposalText: string;
  allVendorPrices: number[];
  procurementTitle: string;
}

export interface VendorScoreResponse {
  score: number;
  reasoning: string;
  breakdown: {
    priceCompetitiveness: number;
    marketPosition: number;
    completeness: number;
    baseQuality: number;
  };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private provider: string;
  private groqApiKey: string;
  private groqModel: string;
  private copilotSecret: string;

  constructor(private configService: ConfigService) {
    this.provider = this.configService.get<string>('AI_PROVIDER') || 'groq';
    this.groqApiKey = this.configService.get<string>('GROQ_API_KEY') || '';
    this.groqModel = this.configService.get<string>('GROQ_MODEL') || 'llama-3.3-70b-versatile';
    this.copilotSecret = this.configService.get<string>('COPILOT_STUDIO_SECRET') || '';
    this.logger.log(`AI provider: ${this.provider}`);
  }

  private async callAI(prompt: string): Promise<string> {
    if (this.provider === 'copilot' && this.copilotSecret) {
      return this.callCopilotStudio(prompt);
    }
    return this.callGroq(prompt);
  }

  private async callGroq(prompt: string): Promise<string> {
    if (!this.groqApiKey) {
      this.logger.warn('Groq API key not configured');
      throw new Error('AI service not configured');
    }

    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.groqApiKey}`,
      },
      body: JSON.stringify({
        model: this.groqModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Groq API error: ${error}`);
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async callCopilotStudio(prompt: string): Promise<string> {
    if (!this.copilotSecret) {
      this.logger.warn('Copilot Studio secret not configured');
      throw new Error('Copilot Studio not configured');
    }

    try {
      const conversationResponse = await fetch('https://directline.botframework.com/v3/directline/conversations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.copilotSecret}`,
          'Content-Type': 'application/json',
        },
      });

      if (!conversationResponse.ok) {
        const errText = await conversationResponse.text();
        this.logger.error(`Copilot conversation error: ${conversationResponse.status} - ${errText}`);
        throw new Error(`Conversation creation failed: ${conversationResponse.status}`);
      }

      const convData = await conversationResponse.json();
      const conversationId = convData.conversationId;
      const token = convData.token;

      const sendUrl = `https://directline.botframework.com/v3/directline/conversations/${conversationId}/activities`;
      const messageResponse = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'message',
          from: { id: 'ebidding-system', name: 'E-Bidding System' },
          text: prompt,
        }),
      });

      if (!messageResponse.ok) {
        throw new Error(`Message send failed: ${messageResponse.status}`);
      }

      await new Promise(resolve => setTimeout(resolve, 5000));

      const activitiesResponse = await fetch(`${sendUrl}?watermark=0`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!activitiesResponse.ok) {
        throw new Error(`Activities fetch failed: ${activitiesResponse.status}`);
      }

      const activitiesData = await activitiesResponse.json();
      const botMessages = activitiesData.activities?.filter(
        (a: any) => a.from?.id !== 'ebidding-system' && a.type === 'message' && a.text
      );

      if (botMessages && botMessages.length > 0) {
        return botMessages[botMessages.length - 1].text;
      }

      throw new Error('No response from Copilot Studio');
    } catch (error) {
      this.logger.error(`Copilot Studio error: ${error}`);
      throw error;
    }
  }

  async writeTor(input: TorRequest): Promise<{ tor: string }> {
    try {
      const prompt = this.buildTorPrompt(input);
      const tor = await this.callAI(prompt);
      return { tor };
    } catch (error) {
      this.logger.error(`AI TOR generation failed: ${error}`);
      return { tor: this.generateTemplateTor(input) };
    }
  }

  private buildTorPrompt(input: TorRequest): string {
    return `You are a procurement expert for Centara Hotels & Resorts. Generate a professional Terms of Reference (TOR) document for the following procurement request.

Request Type: ${input.requestType}
Category: ${input.category}
Title: ${input.title}
Description: ${input.description || 'No description provided'}

Requirements:
1. Write in professional business English
2. Include all standard TOR sections (Background, Objectives, Scope, Deliverables, Evaluation Criteria, Timeline)
3. Tailor the content to the ${input.category} category
4. Be specific and actionable
5. Use markdown formatting with headers and bullet points
6. Include realistic timelines (7-30 days depending on complexity)
7. For RFP: Include detailed evaluation criteria with percentages
8. For RFQ: Include pricing requirements and specifications
9. For RFI: Focus on information gathering and market research

Generate the complete TOR document now:`;
  }

  async scoreVendor(input: VendorScoreRequest): Promise<VendorScoreResponse> {
    try {
      const prompt = this.buildScorePrompt(input);
      const response = await this.callAI(prompt);
      return this.parseScoreResponse(response, input);
    } catch (error) {
      this.logger.error(`AI scoring failed: ${error}`);
      return this.fallbackScoring(input);
    }
  }

  private buildScorePrompt(input: VendorScoreRequest): string {
    const avgPrice = input.allVendorPrices.reduce((a, b) => a + b, 0) / input.allVendorPrices.length;
    const minPrice = Math.min(...input.allVendorPrices);
    const maxPrice = Math.max(...input.allVendorPrices);

    return `You are a procurement evaluator for Centara Hotels & Resorts. Analyze this vendor proposal and provide a score.

Procurement: ${input.procurementTitle}
Vendor: ${input.vendorName}
Proposed Price: $${input.price.toLocaleString()}
Proposal Summary: ${input.proposalText || 'No proposal text provided'}

Market Context:
- Average bid: $${Math.round(avgPrice).toLocaleString()}
- Lowest bid: $${minPrice.toLocaleString()}
- Highest bid: $${maxPrice.toLocaleString()}

Score the vendor on a scale of 0-100 based on:
1. Price Competitiveness (40 points): How does the price compare to others?
2. Market Position (20 points): Is the price below or above average?
3. Completeness (20 points): How detailed is the proposal?
4. Base Quality (20 points): General quality assessment

Respond in this exact JSON format:
{
  "score": <number 0-100>,
  "priceCompetitiveness": <number 0-40>,
  "marketPosition": <number 0-20>,
  "completeness": <number 0-20>,
  "baseQuality": <number 0-20>,
  "reasoning": "<detailed explanation of the scoring>"
}`;
  }

  private parseScoreResponse(response: string, input: VendorScoreRequest): VendorScoreResponse {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: Math.min(100, Math.max(0, parsed.score || 50)),
          reasoning: parsed.reasoning || 'AI scoring completed',
          breakdown: {
            priceCompetitiveness: Math.min(40, Math.max(0, parsed.priceCompetitiveness || 20)),
            marketPosition: Math.min(20, Math.max(0, parsed.marketPosition || 10)),
            completeness: Math.min(20, Math.max(0, parsed.completeness || 10)),
            baseQuality: Math.min(20, Math.max(0, parsed.baseQuality || 10)),
          },
        };
      }
    } catch (error) {
      this.logger.error(`Failed to parse AI response: ${error}`);
    }
    return this.fallbackScoring(input);
  }

  private fallbackScoring(input: VendorScoreRequest): VendorScoreResponse {
    const avgPrice = input.allVendorPrices.reduce((a, b) => a + b, 0) / input.allVendorPrices.length;
    const maxPrice = Math.max(...input.allVendorPrices);
    const minPrice = Math.min(...input.allVendorPrices);
    const priceRange = maxPrice - minPrice || 1;

    const priceScore = Math.round(((maxPrice - input.price) / priceRange) * 40 + 60);
    const competitivenessScore = input.price <= avgPrice ? 20 : Math.round(20 * (1 - (input.price - avgPrice) / priceRange));
    const totalScore = Math.min(100, Math.max(0, priceScore + 20 + competitivenessScore + 20));

    return {
      score: totalScore,
      reasoning: `Fallback scoring based on price analysis:
Price: $${input.price.toLocaleString()}
Market Average: $${Math.round(avgPrice).toLocaleString()}
Position: ${input.price <= avgPrice ? 'Below average (competitive)' : 'Above average'}`,
      breakdown: {
        priceCompetitiveness: priceScore,
        marketPosition: competitivenessScore,
        completeness: 20,
        baseQuality: 20,
      },
    };
  }

  private generateTemplateTor(input: TorRequest): string {
    return `## Terms of Reference — ${input.requestType}

### 1. Background & Context
${input.title} is a procurement initiative under the ${input.category} category.

${input.description ? `**Brief:** ${input.description}` : ''}

### 2. Objectives
- Define clear requirements for this procurement
- Ensure competitive and transparent selection process
- Achieve value for money

### 3. Scope
- Detailed requirements to be defined based on ${input.category} needs

### 4. Timeline
- To be determined based on complexity

### 5. Evaluation Criteria
- Compliance with requirements
- Cost-effectiveness
- Vendor capability`;
  }
}
