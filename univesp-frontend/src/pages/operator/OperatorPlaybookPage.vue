<script setup>
import ActionTile from '@/components/ActionTile.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import { operatorPlaybookTree } from '../../../mocks/knowledgeBase'
</script>

<template>
  <div class="grid gap-6">
    <SectionPanel
      eyebrow="OP"
      title="FAQ operacional e playbook"
      description="Base para o repositório operacional do OP antes do escalonamento para area interna."
    >
      <div class="grid gap-4 xl:grid-cols-3">
        <ActionTile
          v-for="node in operatorPlaybookTree"
          :key="node.id"
          :title="node.title"
          :description="node.description"
          eyebrow="Playbook"
        >
          <div class="mt-4 grid gap-2">
            <div
              v-for="step in node.steps"
              :key="step"
              class="rounded-[18px] bg-slate-100 px-4 py-3 text-sm text-slate-700"
            >
              {{ step }}
            </div>
          </div>
        </ActionTile>
      </div>
    </SectionPanel>
  </div>
</template>
