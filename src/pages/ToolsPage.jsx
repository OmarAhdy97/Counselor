import { PageHead, Segmented } from '../components/ui'
import { useUI } from '../context/UIContext'
import DeadlineTool from './tools/DeadlineTool'
import FeesTool from './tools/FeesTool'
import InterestTool from './tools/InterestTool'
import TafqitTool from './tools/TafqitTool'
import FolderTool from './tools/FolderTool'
import LetterTool from './tools/LetterTool'
import ContractTool from './tools/ContractTool'
import DirectoryTool from './tools/DirectoryTool'
import LawsTool from './tools/LawsTool'

export const TOOLS = [
  { value: 'deadlines', label: 'المواعيد', el: DeadlineTool },
  { value: 'fees', label: 'الرسوم', el: FeesTool },
  { value: 'interest', label: 'الفوائد', el: InterestTool },
  { value: 'tafqit', label: 'المبلغ بالحروف', el: TafqitTool },
  { value: 'folder', label: 'حافظة مستندات', el: FolderTool },
  { value: 'letters', label: 'خطابات', el: LetterTool },
  { value: 'contracts', label: 'عقود', el: ContractTool },
  { value: 'laws', label: 'التشريعات', el: LawsTool },
  { value: 'directory', label: 'الدليل', el: DirectoryTool },
]

export default function ToolsPage() {
  const { tool, setTool } = useUI()
  const current = TOOLS.find((t) => t.value === tool.id) || TOOLS[0]
  const Tool = current.el

  return (
    <div className="page">
      <PageHead title="الأدوات" subtitle="حاسبات ومستندات جاهزة للطباعة" />
      <div className="toolbar no-print">
        <Segmented value={current.value} onChange={(id) => setTool((t) => ({ ...t, id }))} options={TOOLS.map(({ value, label }) => ({ value, label }))} />
      </div>
      <Tool />
    </div>
  )
}
