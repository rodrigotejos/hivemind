import fs from 'fs';
import path from 'path';

export interface ProjectInspectionResult {
  isCompliant: boolean;
  missingComponents: string[];
  existingComponents: string[];
}

export class ProjectSetupService {
  private static instance: ProjectSetupService;

  private constructor() {}

  public static getInstance(): ProjectSetupService {
    if (!ProjectSetupService.instance) {
      ProjectSetupService.instance = new ProjectSetupService();
    }
    return ProjectSetupService.instance;
  }

  public inspect(targetDir: string): ProjectInspectionResult {
    const requiredPaths = [
      '.aidlc',
      '.agent/rules/ai-dlc.md',
      '.agent/skills',
      'AGENTS.md',
      '.kiro/steering/ai-dlc.md',
    ];

    const missingComponents: string[] = [];
    const existingComponents: string[] = [];

    for (const reqPath of requiredPaths) {
      const fullPath = path.join(targetDir, reqPath);
      if (fs.existsSync(fullPath)) {
        existingComponents.push(reqPath);
      } else {
        missingComponents.push(reqPath);
      }
    }

    return {
      isCompliant: missingComponents.length === 0,
      missingComponents,
      existingComponents,
    };
  }

  public bootstrap(targetDir: string): { success: boolean; generatedFiles: string[] } {
    const generatedFiles: string[] = [];

    // 1. Cria diretórios
    const dirs = [
      path.join(targetDir, '.aidlc'),
      path.join(targetDir, '.agent', 'rules'),
      path.join(targetDir, '.agent', 'skills'),
      path.join(targetDir, '.kiro', 'steering'),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        generatedFiles.push(dir);
      }
    }

    // 2. Cria AGENTS.md
    const agentsMdPath = path.join(targetDir, 'AGENTS.md');
    if (!fs.existsSync(agentsMdPath)) {
      const agentsContent = `# AI-DLC Workflow\n\nWhen the user invokes AI-DLC, read and follow\n\`.aidlc/aidlc-rules/aws-aidlc-rules/core-workflow.md\` to start the workflow.\n\n# Codebase Memory MCP\n\nAll agents should prioritize using the \`codebase-memory\` MCP server (via \`call_mcp_tool\`) for codebase exploration, symbol search, architecture insights, and dependency tracing.\n`;
      fs.writeFileSync(agentsMdPath, agentsContent, 'utf-8');
      generatedFiles.push('AGENTS.md');
    }

    // 3. Cria .agent/rules/ai-dlc.md
    const agentRulePath = path.join(targetDir, '.agent', 'rules', 'ai-dlc.md');
    if (!fs.existsSync(agentRulePath)) {
      const ruleContent = `# AI-DLC Workflow Rule\n\nWhen the user invokes AI-DLC, read and follow \`.aidlc/aidlc-rules/aws-aidlc-rules/core-workflow.md\`.\n`;
      fs.writeFileSync(agentRulePath, ruleContent, 'utf-8');
      generatedFiles.push('.agent/rules/ai-dlc.md');
    }

    // 4. Cria .kiro/steering/ai-dlc.md
    const kiroSteeringPath = path.join(targetDir, '.kiro', 'steering', 'ai-dlc.md');
    if (!fs.existsSync(kiroSteeringPath)) {
      const kiroContent = `# AI-DLC Steering\n\nFollow \`.aidlc/aidlc-rules/aws-aidlc-rules/core-workflow.md\` for all AI-DLC workflows.\n`;
      fs.writeFileSync(kiroSteeringPath, kiroContent, 'utf-8');
      generatedFiles.push('.kiro/steering/ai-dlc.md');
    }

    // 5. Garante .aidlc/ no .gitignore
    const gitignorePath = path.join(targetDir, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
      if (!gitignore.includes('.aidlc/')) {
        fs.appendFileSync(gitignorePath, '\n# AI-DLC workflow directory\n.aidlc/\n', 'utf-8');
        generatedFiles.push('.gitignore (updated)');
      }
    } else {
      fs.writeFileSync(gitignorePath, '# AI-DLC workflow directory\n.aidlc/\n', 'utf-8');
      generatedFiles.push('.gitignore (created)');
    }

    return {
      success: true,
      generatedFiles,
    };
  }
}
