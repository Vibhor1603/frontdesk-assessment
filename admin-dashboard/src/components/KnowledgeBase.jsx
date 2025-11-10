import { formatTimestamp } from "../utils/formatters";

export function KnowledgeBase({
  items,
  editingItem,
  editForm,
  isAddingNew,
  newItemForm,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onAddNew,
  onCreateNew,
  onCancelNew,
  onEditFormChange,
  onNewFormChange,
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-4">
        <button
          onClick={onAddNew}
          className="px-6 py-3 bg-white text-black hover:bg-gray-200 rounded-xl transition-all font-medium"
        >
          + Add New
        </button>
      </div>

      {isAddingNew && (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 mb-4">
          <h3 className="text-white text-lg mb-4">
            Add New Knowledge Base Item
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">
                Question
              </label>
              <input
                type="text"
                value={newItemForm.question}
                onChange={(e) => onNewFormChange("question", e.target.value)}
                placeholder="Enter the question..."
                className="w-full bg-white/5 text-white rounded-xl p-4 focus:bg-white/10 focus:outline-none placeholder-gray-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Answer</label>
              <textarea
                value={newItemForm.answer}
                onChange={(e) => onNewFormChange("answer", e.target.value)}
                placeholder="Enter the answer..."
                className="w-full bg-white/5 text-white rounded-xl p-4 focus:bg-white/10 focus:outline-none resize-none placeholder-gray-500"
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={onCreateNew}
                className="px-6 py-2 bg-white text-black hover:bg-gray-200 rounded-xl transition-all font-medium"
              >
                Create
              </button>
              <button
                onClick={onCancelNew}
                className="px-6 py-2 bg-white/5 text-white hover:bg-white/10 rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 && !isAddingNew ? (
        <div className="text-center py-20 text-gray-500">
          No knowledge base items yet. Click "Add New" to create one.
        </div>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/10 transition-all"
          >
            {editingItem === item.id ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">
                    Question
                  </label>
                  <input
                    type="text"
                    value={editForm.question}
                    onChange={(e) =>
                      onEditFormChange("question", e.target.value)
                    }
                    className="w-full bg-white/5 text-white rounded-xl p-4 focus:bg-white/10 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">
                    Answer
                  </label>
                  <textarea
                    value={editForm.answer}
                    onChange={(e) => onEditFormChange("answer", e.target.value)}
                    className="w-full bg-white/5 text-white rounded-xl p-4 focus:bg-white/10 focus:outline-none resize-none"
                    rows={4}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onSave(item.id)}
                    className="px-6 py-2 bg-white text-black hover:bg-gray-200 rounded-xl transition-all font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={onCancel}
                    className="px-6 py-2 bg-white/5 text-white hover:bg-white/10 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div className="text-sm text-gray-500">
                    {formatTimestamp(item.created_at)}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(item)}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(item.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-sm text-gray-400 mb-1">Q:</div>
                  <div className="text-white mb-4">{item.question}</div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <div className="text-sm text-gray-400 mb-1">A:</div>
                  <div className="text-green-400">{item.answer}</div>
                </div>

                {item.times_used > 0 && (
                  <div className="text-xs text-gray-500 mt-4">
                    Used {item.times_used} times
                  </div>
                )}
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
