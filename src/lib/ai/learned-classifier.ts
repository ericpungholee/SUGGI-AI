/**
 * Learned Classifier for Intent Classification
 * Uses logistic regression on embeddings for fast, accurate routing
 */

import { embeddingService } from './embedding-service'

interface TrainingExample {
  query: string
  intent: string
  confidence: number
  features?: number[]
}

interface ClassificationResult {
  intent: string
  confidence: number
  probabilities: Record<string, number>
}

interface ClassifierMetrics {
  accuracy: number
  precision: Record<string, number>
  recall: Record<string, number>
  f1Score: Record<string, number>
}

export class LearnedClassifier {
  private static instance: LearnedClassifier
  private weights: Map<string, number[]> = new Map()
  private biases: Map<string, number> = new Map()
  private featureMeans: number[] = []
  private featureStds: number[] = []
  private isTrained = false
  private readonly learningRate = 0.01
  private readonly maxIterations = 1000
  private readonly regularization = 0.01
  private readonly intents = ['ask', 'web_search', 'rag_query', 'edit_request', 'editor_write', 'other']

  private constructor() {
    this.initializeWeights()
  }

  static getInstance(): LearnedClassifier {
    if (!LearnedClassifier.instance) {
      LearnedClassifier.instance = new LearnedClassifier()
    }
    return LearnedClassifier.instance
  }

  /**
   * Train the classifier on labeled examples
   */
  async train(examples: TrainingExample[]): Promise<ClassifierMetrics> {
    console.log(`🧠 Training classifier on ${examples.length} examples...`)
    
    // Generate embeddings for all examples
    const trainingData = await Promise.all(
      examples.map(async (example) => ({
        ...example,
        features: await embeddingService.getEmbedding(example.query)
      }))
    )

    // Normalize features
    this.normalizeFeatures(trainingData)

    // Train one-vs-all logistic regression for each intent
    for (const intent of this.intents) {
      await this.trainIntentClassifier(intent, trainingData)
    }

    this.isTrained = true

    // Calculate metrics
    const metrics = await this.calculateMetrics(trainingData)
    console.log('✅ Classifier training completed:', metrics)
    
    return metrics
  }

  /**
   * Classify a query using the trained model
   */
  async classify(query: string): Promise<ClassificationResult> {
    if (!this.isTrained) {
      // Return uniform distribution if not trained
      const uniformProb = 1.0 / this.intents.length
      const probabilities = Object.fromEntries(
        this.intents.map(intent => [intent, uniformProb])
      )
      
      return {
        intent: 'ask',
        confidence: uniformProb,
        probabilities
      }
    }

    const features = await embeddingService.getEmbedding(query)
    const normalizedFeatures = this.normalizeVector(features)
    
    const probabilities: Record<string, number> = {}
    let maxProb = 0
    let predictedIntent = 'ask'

    // Calculate probabilities for each intent
    for (const intent of this.intents) {
      const weights = this.weights.get(intent) || []
      const bias = this.biases.get(intent) || 0
      
      const logit = this.dotProduct(normalizedFeatures, weights) + bias
      const probability = this.sigmoid(logit)
      
      probabilities[intent] = probability
      
      if (probability > maxProb) {
        maxProb = probability
        predictedIntent = intent
      }
    }

    // Normalize probabilities to sum to 1
    const totalProb = Object.values(probabilities).reduce((sum, prob) => sum + prob, 0)
    Object.keys(probabilities).forEach(intent => {
      probabilities[intent] /= totalProb
    })

    return {
      intent: predictedIntent,
      confidence: maxProb,
      probabilities
    }
  }

  /**
   * Add feedback to improve the classifier
   */
  async addFeedback(
    query: string, 
    correctIntent: string, 
    predictedIntent: string,
    confidence: number
  ): Promise<void> {
    if (correctIntent === predictedIntent) return

    // Add the corrected example for retraining
    const example: TrainingExample = {
      query,
      intent: correctIntent,
      confidence: 1.0
    }

    // In a production system, you'd add this to a feedback queue
    // and retrain periodically. For now, we'll just log it.
    console.log(`📝 Feedback: "${query}" should be "${correctIntent}" not "${predictedIntent}"`)
    
    // TODO: Implement incremental learning or add to retraining queue
  }

  /**
   * Get classifier status
   */
  getStatus(): { isTrained: boolean; intents: string[]; weightsLoaded: boolean } {
    return {
      isTrained: this.isTrained,
      intents: this.intents,
      weightsLoaded: this.weights.size > 0
    }
  }

  /**
   * Initialize weights and biases for all intents
   */
  private initializeWeights(): void {
    const dimension = 1536 // text-embedding-3-small dimension
    
    for (const intent of this.intents) {
      // Initialize weights with small random values
      const weights = Array(dimension).fill(0).map(() => (Math.random() - 0.5) * 0.01)
      this.weights.set(intent, weights)
      this.biases.set(intent, 0)
    }
  }

  /**
   * Train classifier for a specific intent (one-vs-all)
   */
  private async trainIntentClassifier(
    intent: string, 
    trainingData: Array<TrainingExample & { features: number[] }>
  ): Promise<void> {
    const weights = this.weights.get(intent)!
    const bias = this.biases.get(intent)!
    
    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      let totalLoss = 0
      const gradientWeights = new Array(weights.length).fill(0)
      let gradientBias = 0

      // Calculate gradients
      for (const example of trainingData) {
        const isPositive = example.intent === intent ? 1 : 0
        const prediction = this.sigmoid(this.dotProduct(example.features, weights) + bias)
        const loss = prediction - isPositive
        
        totalLoss += Math.abs(loss)

        // Update gradients
        for (let i = 0; i < weights.length; i++) {
          gradientWeights[i] += loss * example.features[i]
        }
        gradientBias += loss
      }

      // Apply regularization
      for (let i = 0; i < weights.length; i++) {
        gradientWeights[i] += this.regularization * weights[i]
      }

      // Update weights and bias
      for (let i = 0; i < weights.length; i++) {
        weights[i] -= this.learningRate * gradientWeights[i]
      }
      this.biases.set(intent, bias - this.learningRate * gradientBias)

      // Check convergence
      if (totalLoss / trainingData.length < 0.01) {
        break
      }
    }
  }

  /**
   * Normalize features using z-score normalization
   */
  private normalizeFeatures(trainingData: Array<TrainingExample & { features: number[] }>): void {
    const dimension = trainingData[0].features.length
    const featureMeans = new Array(dimension).fill(0)
    const featureStds = new Array(dimension).fill(0)

    // Calculate means
    for (const example of trainingData) {
      for (let i = 0; i < dimension; i++) {
        featureMeans[i] += example.features[i]
      }
    }
    
    for (let i = 0; i < dimension; i++) {
      featureMeans[i] /= trainingData.length
    }

    // Calculate standard deviations
    for (const example of trainingData) {
      for (let i = 0; i < dimension; i++) {
        const diff = example.features[i] - featureMeans[i]
        featureStds[i] += diff * diff
      }
    }
    
    for (let i = 0; i < dimension; i++) {
      featureStds[i] = Math.sqrt(featureStds[i] / trainingData.length)
      if (featureStds[i] === 0) featureStds[i] = 1 // Avoid division by zero
    }

    this.featureMeans = featureMeans
    this.featureStds = featureStds

    // Normalize all features
    for (const example of trainingData) {
      for (let i = 0; i < dimension; i++) {
        example.features[i] = (example.features[i] - featureMeans[i]) / featureStds[i]
      }
    }
  }

  /**
   * Normalize a single vector using stored means and stds
   */
  private normalizeVector(features: number[]): number[] {
    return features.map((value, i) => 
      (value - this.featureMeans[i]) / this.featureStds[i]
    )
  }

  /**
   * Calculate dot product of two vectors
   */
  private dotProduct(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    
    let sum = 0
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i]
    }
    return sum
  }

  /**
   * Sigmoid activation function
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))))
  }

  /**
   * Calculate classification metrics
   */
  private async calculateMetrics(
    testData: Array<TrainingExample & { features: number[] }>
  ): Promise<ClassifierMetrics> {
    const confusionMatrix: Record<string, Record<string, number>> = {}
    const intents = [...new Set(testData.map(d => d.intent))]

    // Initialize confusion matrix
    for (const trueIntent of intents) {
      confusionMatrix[trueIntent] = {}
      for (const predIntent of intents) {
        confusionMatrix[trueIntent][predIntent] = 0
      }
    }

    // Calculate predictions
    for (const example of testData) {
      const prediction = await this.classify(example.query)
      confusionMatrix[example.intent][prediction.intent]++
    }

    // Calculate metrics
    const precision: Record<string, number> = {}
    const recall: Record<string, number> = {}
    const f1Score: Record<string, number> = {}

    for (const intent of intents) {
      const truePositives = confusionMatrix[intent][intent]
      const falsePositives = Object.values(confusionMatrix)
        .reduce((sum, row) => sum + (row[intent] || 0), 0) - truePositives
      const falseNegatives = Object.values(confusionMatrix[intent])
        .reduce((sum, count) => sum + count, 0) - truePositives

      precision[intent] = truePositives + falsePositives > 0 
        ? truePositives / (truePositives + falsePositives) 
        : 0
      
      recall[intent] = truePositives + falseNegatives > 0 
        ? truePositives / (truePositives + falseNegatives) 
        : 0
      
      f1Score[intent] = precision[intent] + recall[intent] > 0 
        ? 2 * (precision[intent] * recall[intent]) / (precision[intent] + recall[intent])
        : 0
    }

    const totalCorrect = Object.values(confusionMatrix)
      .reduce((sum, row) => sum + Object.values(row).reduce((s, c) => s + c, 0), 0)
    const accuracy = totalCorrect / testData.length

    return {
      accuracy,
      precision,
      recall,
      f1Score
    }
  }
}

// Export singleton
export const learnedClassifier = LearnedClassifier.getInstance()
