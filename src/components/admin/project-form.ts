export type ProjectFormValue = {
  id?: string;
  name: string;
  members: string;
  description: string;
  prototypeUrl: string;
  presentationUrl: string;
};

export const emptyProject: ProjectFormValue = {
  name: "",
  members: "",
  description: "",
  prototypeUrl: "",
  presentationUrl: "",
};
