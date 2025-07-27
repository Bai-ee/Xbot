// Base Agent Class for all multi-agent system agents
class BaseAgent {
  constructor(name, specializations = []) {
    this.name = name;
    this.specializations = specializations;
    this.stats = {
      tasksExecuted: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0
    };
  }

  async executeTask(input, context = {}) {
    const startTime = Date.now();
    this.stats.tasksExecuted++;

    try {
      const result = await this.handleMessage(input, context);
      const executionTime = Date.now() - startTime;
      
      this.stats.tasksSucceeded++;
      this.stats.totalExecutionTime += executionTime;
      this.stats.averageExecutionTime = Math.round(this.stats.totalExecutionTime / this.stats.tasksExecuted);

      console.log(`✅ ${this.name} completed task`, {
        executionTime,
        success: true
      });

      return {
        success: true,
        result,
        agent: this.name,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.stats.tasksFailed++;
      this.stats.totalExecutionTime += executionTime;

      console.error(`❌ ${this.name} failed task`, {
        executionTime,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        agent: this.name,
        executionTime
      };
    }
  }

  // Abstract method - must be implemented by subclasses
  async handleMessage(input, context = {}) {
    throw new Error(`${this.name} must implement handleMessage method`);
  }

  // Get agent performance statistics
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.tasksExecuted > 0 
        ? Math.round((this.stats.tasksSucceeded / this.stats.tasksExecuted) * 100) 
        : 100
    };
  }

  // Reset statistics
  resetStats() {
    this.stats = {
      tasksExecuted: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0
    };
  }

  // Check if agent can handle specific specialization
  canHandle(specialization) {
    return this.specializations.includes(specialization) || this.specializations.includes('general');
  }

  // Health check for agent status
  async healthCheck() {
    return {
      healthy: true,
      name: this.name,
      stats: this.stats,
      specializations: this.specializations
    };
  }
}

module.exports = { BaseAgent }; 